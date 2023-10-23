const { RecordMonitoring } = require('../utils/monitoring');
const { ethers } = require('ethers');
const { fnName, roundTo, sleep } = require('../utils/utils');
const { dashboardPairsToCompute } = require('./precomputer.config');
const { DATA_DIR, PLATFORMS } = require('../utils/constants');
const RUN_EVERY_MINUTES = 3 * 60; // in minutes
const MONITORING_NAME = 'Dashboard Precomputer';
const RPC_URL = process.env.RPC_URL;
const fs = require('fs');
const path = require('path');
const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { getLiquidity, getLiquidityAllPlatforms } = require('../data.interface/data.interface');
const { computeParkinsonVolatility } = require('../utils/volatility');
const { getDefaultSlippageMap } = require('../data.interface/internal/data.interface.utils');

const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
const TARGET_DATA_POINTS = 200;
const NB_DAYS = 180;
const NB_DAYS_AVG = 30;
const NB_AVG_POINTS = Math.round(NB_DAYS / NB_DAYS_AVG); // have an average every 30 days

async function PrecomputeDashboardData() {
// eslint-disable-next-line no-constant-condition
    while(true) {
        const runStartDate = Date.now();
        console.log({TARGET_DATA_POINTS});
        console.log({NB_DAYS});
        console.log({NB_DAYS_AVG});
        console.log({NB_AVG_POINTS});
        try {
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'running',
                'lastStart': Math.round(runStartDate/1000),
                'runEvery': RUN_EVERY_MINUTES * 60
            });

            const currentBlock = await web3Provider.getBlockNumber() - 100;

            const daysAgo = Math.round(Date.now()/1000) - NB_DAYS * 24 * 60 * 60;
            const startBlock =  await getBlocknumberForTimestamp(daysAgo);
            const blockStep = Math.round((currentBlock - startBlock) / TARGET_DATA_POINTS);
            console.log({blockStep});
            const displayBlocks = [];
            for(let b = startBlock; b <= currentBlock; b+= blockStep) {
                displayBlocks.push(b);
            }

            const avgStep = Math.round((currentBlock - startBlock) / NB_AVG_POINTS);
            console.log({avgStep});
            const dirPath = path.join(DATA_DIR, 'precomputed', 'dashboard');
            if(!fs.existsSync(path.join(DATA_DIR, 'precomputed', 'dashboard'))) {
                fs.mkdirSync(dirPath);
            }

            for(const pair of dashboardPairsToCompute) {
                console.log(`${fnName()}: precomputing for pair ${pair.base}/${pair.quote}`);
                for(const platform of PLATFORMS) {
                    console.log(`${fnName()}[${pair.base}/${pair.quote}]: precomputing for platform ${platform}`);
                    // get the liquidity since startBlock - avgStep because, for the first block (= startBlock), we will compute the avg liquidity and volatility also
                    const platformLiquidity = getLiquidity(platform, pair.base, pair.quote, startBlock - avgStep, currentBlock, true);
                    if(platformLiquidity) {
                        // if volatilitypivot is set, fetch the block prices for segment1 and segment2
                        // example for APE/USDC, we go through WETH for the price: 
                        // APE/WETH * WETH/USDC
                        const pricesAtBlock = {};
                        if(pair.volatilityPivot) {
                            const segment1Prices = Object.entries(getLiquidity(platform, pair.base, pair.volatilityPivot, startBlock - avgStep, currentBlock, false)).reduce((d, v) => (d[v[0]] = v[1].price, d), {});
                            const segment2Prices = Object.entries(getLiquidity(platform, pair.volatilityPivot, pair.quote, startBlock - avgStep, currentBlock, false)).reduce((d, v) => (d[v[0]] = v[1].price, d), {});
                            for(const block of Object.keys(segment1Prices)) {
                                pricesAtBlock[block] = segment1Prices[block] * segment2Prices[block];
                            }
                        // else, fill the pricesAtBlock from the platform liquidity data
                        } else {
                            for(const block of Object.keys(platformLiquidity)) {
                                pricesAtBlock[block] = platformLiquidity[block].price;
                            }
                        }

                        generateDashboardDataFromLiquidityData(platformLiquidity, pricesAtBlock, displayBlocks, avgStep, pair, dirPath, platform);                        
                    }
                }

                // then also do for all platforms
                const allLiquidity = getLiquidityAllPlatforms(pair.base, pair.quote, startBlock - avgStep, currentBlock, true);
                if(allLiquidity) {
                    // if volatilitypivot is set, fetch the block prices for segment1 and segment2
                    const pricesAtBlock = {};
                    if(pair.volatilityPivot) {
                        const segment1Prices = Object.entries(getLiquidityAllPlatforms(pair.base, pair.volatilityPivot, startBlock - avgStep, currentBlock, false)).reduce((d, v) => (d[v[0]] = v[1].price, d), {});
                        const segment2Prices = Object.entries(getLiquidityAllPlatforms(pair.volatilityPivot, pair.quote, startBlock - avgStep, currentBlock, false)).reduce((d, v) => (d[v[0]] = v[1].price, d), {});
                        for(const block of Object.keys(segment1Prices)) {
                            pricesAtBlock[block] = segment1Prices[block] * segment2Prices[block];
                        }
                        // else, fill the pricesAtBlock from the platform liquidity data
                    } else {
                        for(const block of Object.keys(allLiquidity)) {
                            pricesAtBlock[block] = allLiquidity[block].price;
                        }
                    }

                    generateDashboardDataFromLiquidityData(allLiquidity, pricesAtBlock, displayBlocks, avgStep, pair, dirPath, 'all');                        
                }
            }

            const runEndDate = Math.round(Date.now() / 1000);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'success',
                'lastEnd': runEndDate,
                'lastDuration': runEndDate - Math.round(runStartDate / 1000)
            });
    
            const sleepTime = RUN_EVERY_MINUTES * 60 * 1000 - (Date.now() - runStartDate);
            if(sleepTime > 0) {
                console.log(`${fnName()}: sleeping ${roundTo(sleepTime/1000/60)} minutes`);
                await sleep(sleepTime);
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

            console.log('sleeping 10 minutes');
            await sleep(10 * 60 * 1000);
        }

        
    }

}

function generateDashboardDataFromLiquidityData(platformLiquidity, pricesAtBlock, displayBlocks, avgStep, pair, dirPath, platform) {
    const platformOutputResult = {};
    // compute average liquidity over ~= 30 days for all the display blocks
    const liquidityBlocks = Object.keys(platformLiquidity).map(_ => Number(_));

    for (const block of displayBlocks) {
        platformOutputResult[block] = {};
        const nearestBlockBefore = liquidityBlocks.filter(_ => _ <= block).at(-1);
        if (!nearestBlockBefore) {
            throw new Error(`Could not find blocks <= ${block} in liquidity data`);
        }

        const nearestBlockData = platformLiquidity[nearestBlockBefore];
        platformOutputResult[block].price = pricesAtBlock[nearestBlockBefore];
        platformOutputResult[block].slippageMap = nearestBlockData.slippageMap;

        const startBlockForAvg = block - avgStep;
        // average for all blocks in interval [startBlockForAvg -> block]
        const blocksToAverage = liquidityBlocks.filter(_ => _ <= block && _ >= startBlockForAvg);
        const avgSlippage = getDefaultSlippageMap();
        let avgPrice = 0;
        let nonZeroPriceCount = 0;
        for (const blockToAvg of blocksToAverage) {
            for (const slippageBps of Object.keys(avgSlippage)) {
                avgSlippage[slippageBps].base += platformLiquidity[blockToAvg].slippageMap[slippageBps].base;
                avgSlippage[slippageBps].quote += platformLiquidity[blockToAvg].slippageMap[slippageBps].quote;
            }

            if(platformLiquidity[blockToAvg].price > 0) {
                avgPrice += platformLiquidity[blockToAvg].price;
                nonZeroPriceCount++;
            }
        }

        if(nonZeroPriceCount == 0) {
            avgPrice = 0;
        } else {
            avgPrice = avgPrice / nonZeroPriceCount;
        }

        for (const slippageBps of Object.keys(avgSlippage)) {
            avgSlippage[slippageBps].base = avgSlippage[slippageBps].base / blocksToAverage.length;
            avgSlippage[slippageBps].quote = avgSlippage[slippageBps].quote / blocksToAverage.length;
            if(avgPrice > 0) {
                const tradePrice = avgSlippage[slippageBps].quote / avgSlippage[slippageBps].base;
                avgSlippage[slippageBps].avgSlippage = 1 - (tradePrice / avgPrice);
            }
        }

        const volatility = computeParkinsonVolatility(pricesAtBlock, pair.base, pair.quote, startBlockForAvg, block, NB_DAYS_AVG);
        platformOutputResult[block].volatility = volatility;
        platformOutputResult[block].avgSlippageMap = avgSlippage;
    }

    const fullFilename = path.join(dirPath, `${pair.base}-${pair.quote}-${platform}.json`);
    fs.writeFileSync(fullFilename, JSON.stringify({ updated: Date.now(), liquidity: platformOutputResult }));
}

PrecomputeDashboardData();

