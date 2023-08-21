const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { ethers } = require('ethers');
const { sleep, fnName, roundTo, logFnDurationWithLabel } = require('../utils/utils');
const { default: axios } = require('axios');
const { RecordMonitoring } = require('../utils/monitoring');
const { pairsToCompute } = require('./precomputer.config');
const { getLiquidity, getVolatility, getAverageLiquidity } = require('../data.interface/data.interface');
const path = require('path');
const { writeFileSync } = require('fs');
const { SPANS, PLATFORMS, DATA_DIR, TARGET_SLIPPAGES } = require('../utils/constants');

const RPC_URL = process.env.RPC_URL;
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
const TARGET_DATA_POINTS = Number(process.env.TARGET_DATA_POINTS || 50);
const BLOCKINFO_URL = process.env.BLOCKINFO_URL;
const RUN_EVERY_MINUTES = process.env.RUN_EVERY || 3 * 60; // in minutes
const MONITORING_NAME = 'Precomputer V2';

/**
 * Precompute data for the risk oracle front
 * @param {number} daysToFetch 
 * @param {number} fetchEveryMinutes
 */
async function precomputeDataV2() {
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const start = Date.now();
        try {
            const runStartDate = Math.round(Date.now()/1000);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'running',
                'lastStart': runStartDate,
                'runEvery': RUN_EVERY_MINUTES * 60
            });

            const currentBlock = await web3Provider.getBlockNumber() - 100;

            for(const span of SPANS) {
                const start = Date.now();
                console.log(`${fnName()}: Will precompute data for the last ${span} day(s)`);
                const startDate = Math.round(Date.now()/1000) - span * 24 * 60 * 60;
                // get the blocknumber for this date
                const startBlock =  await getBlocknumberForTimestamp(startDate);
                // calculate block step considering we want TARGET_DATA_POINTS
                const blockStep = Math.round((currentBlock - startBlock) / TARGET_DATA_POINTS);
                console.log(`${fnName()}: Will precompute data since block ${startBlock} to ${currentBlock} with step: ${blockStep} blocks`);
                const allBlocksForSpan = new Set();

                const precomputedForPlatform = {};
                const averagesForPlatform = {};
                for(const platform of PLATFORMS) {
                    precomputedForPlatform[platform] = [];
                    averagesForPlatform[platform] = {};
                    for(const base of Object.keys(pairsToCompute)) {
                        for(const quote of pairsToCompute[base]) {
                            console.log(`${fnName()} [${base}/${quote}] [${span}d] [step: ${blockStep}]: getting data from ${platform}`);

                            // for each span for each platform for each pairs, we'll get the volatility, the liquidity and the average liquidity
                            const liquidityDataAggreg = getLiquidity(platform, base, quote, startBlock, currentBlock, true, blockStep);
                            if(!liquidityDataAggreg || Object.keys(liquidityDataAggreg).length == 0) {
                                // no data for pair
                                continue;
                            }
                            Object.keys(liquidityDataAggreg).forEach(_ => allBlocksForSpan.add(Number(_)));

                            const volatility = getVolatility(platform, base, quote, startBlock, currentBlock, span);
                            const liquidityAverageAggreg = computeAverageData(liquidityDataAggreg, startBlock, currentBlock);

                            const precomputedObj = toPrecomputed(base, quote, blockStep, liquidityDataAggreg, volatility);
                            precomputedForPlatform[platform].push(precomputedObj);
                            addToAverages(averagesForPlatform[platform], base, quote, blockStep, liquidityAverageAggreg, volatility);
                        }
                    }
                }

                // creating blockrange
                const blockTimeStamps = {};
                for(const blockNumber of allBlocksForSpan) {
                    const blockTimestampResp = await axios.get(BLOCKINFO_URL + `/api/getblocktimestamp?blocknumber=${blockNumber}`);
                    blockTimeStamps[blockNumber] = blockTimestampResp.data.timestamp;
                }
                
                for(const platform of PLATFORMS) {
                    const averageFullFilename = path.join(DATA_DIR, 'precomputed', platform, `averages-${span}d.json`);
                    writeFileSync(averageFullFilename, JSON.stringify(averagesForPlatform[platform]));
                    const concatFullFilename = path.join(DATA_DIR, 'precomputed', platform, `concat-${span}d.json`);
                    const concatObj = {
                        lastUpdate: Date.now(),
                        concatData: precomputedForPlatform[platform],
                        blockTimestamps: blockTimeStamps
                    };
                    writeFileSync(concatFullFilename, JSON.stringify(concatObj));
                }
                logFnDurationWithLabel(start, `Precomputer for span ${span}`);
            }
        } catch(error) {
            console.error(error);
            const errorMsg = `An exception occurred: ${error}`;
            console.log(errorMsg);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'error',
                'error': errorMsg
            });
        }

        const runEndDate = Date.now();
        await RecordMonitoring({
            'name': MONITORING_NAME,
            'status': 'success',
            'lastEnd': runEndDate,
            'lastDuration': runEndDate - Math.round(start / 1000)
        });

        const sleepTime = RUN_EVERY_MINUTES * 60 * 1000 - (Date.now() - start);
        if(sleepTime > 0) {
            console.log(`${fnName()}: sleeping ${roundTo(sleepTime/1000/60)} minutes`);
            await sleep(sleepTime);
        }
    }
}

/**
 * 
 * @param {string} base 
 * @param {string} quote 
 * @param {number} blockStep 
 * @param {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}} liquidityDataAggreg 
 * @param {number} volatility 
 */
function toPrecomputed(base, quote, blockStep, liquidityDataAggreg, volatility) {
    const precomputedObj = {
        base: base,
        quote: quote,
        blockStep: blockStep,
        startPrice: undefined,
        endPrice: undefined,
        volumeForSlippage: [],
        parkinsonVolatility: volatility
    };

    for(const [blockNumber, liquidityData] of Object.entries(liquidityDataAggreg)) {
        if(!precomputedObj.startPrice) {
            precomputedObj.startPrice = liquidityData.price;
        }

        // always set endPrice as the last one that will be saved will really be the last one
        precomputedObj.endPrice = liquidityData.price;

        const volumeForSlippageObj = {
            price: liquidityData.price,
            blockNumber: Number(blockNumber),
            realBlockNumber: Number(blockNumber),
            realBlockNumberDistance: 0,
            aggregated: {}
        };

        for(const slippagePct of TARGET_SLIPPAGES) {
            volumeForSlippageObj[slippagePct] = liquidityData.slippageMap[slippagePct*100];
            volumeForSlippageObj.aggregated[slippagePct] = liquidityData.slippageMap[slippagePct*100];
        }

        precomputedObj.volumeForSlippage.push(volumeForSlippageObj);
    }

    return precomputedObj;
}
/**
 * 
 * @param {*} averages 
 * @param {string} base 
 * @param {string} quote 
 * @param {number} blockStep 
 * @param  {{avgPrice: number, avgSlippageMap: { [slippageBps: number]: number }}} liquidityAverageAggreg 
 * @param {number} volatility 
 * @param {*} volatility 
 */
function addToAverages(averages, base, quote, blockStep, liquidityAverageAggreg, volatility) {
    if(!averages[base]) {
        averages[base] = {};
    }

    averages[base][quote] = {
        avgLiquidity: {},
        avgLiquidityAggreg: {},
        volatility: volatility,
        parkinsonVolatility: volatility,
    };

    for(const slippagePct of TARGET_SLIPPAGES) {
        averages[base][quote].avgLiquidity[slippagePct] = liquidityAverageAggreg.avgSlippageMap[slippagePct*100];
        averages[base][quote].avgLiquidityAggreg[slippagePct] = liquidityAverageAggreg.avgSlippageMap[slippagePct*100];
    }
}


/**
 * Compute average slippage map and price
 * @param {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}} liquidityDataForInterval 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{avgPrice: number, avgSlippageMap: {[slippageBps: number]: number}}
 */
function computeAverageData(liquidityDataForInterval, fromBlock, toBlock) {
    let dataToUse = liquidityDataForInterval[fromBlock];
    const avgSlippageMap = {};
    for(let i = 50; i <= 2000; i+=50) {
        avgSlippageMap[i] = 0;
    }

    let avgPrice = 0;
    let cptValues = 0;
    for (let targetBlock = fromBlock; targetBlock <= toBlock; targetBlock++) {
        cptValues++;
        if (liquidityDataForInterval[targetBlock]) {
            dataToUse = liquidityDataForInterval[targetBlock];
        }

        avgPrice += dataToUse.price;
        for (const slippageBps of Object.keys(avgSlippageMap)) {
            avgSlippageMap[slippageBps] += dataToUse.slippageMap[slippageBps];
        }
    }

    avgPrice = avgPrice / cptValues;

    for (const slippageBps of Object.keys(avgSlippageMap)) {
        avgSlippageMap[slippageBps] = avgSlippageMap[slippageBps] / cptValues;
    }

    return {avgPrice: avgPrice, avgSlippageMap: avgSlippageMap};
}

precomputeDataV2();