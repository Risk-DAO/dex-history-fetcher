const fs = require('fs');
const { getConfTokenBySymbol } = require('../utils/token.utils');
const { pairsToCompute } = require('./precomputer.config');
const { fnName, logFnDuration } = require('../utils/utils');
const path = require('path');
const { getAvailableUniswapV3, getUniV3DataforBlockRange, computeUniv3ParkinsonVolatility } = require('../uniswap.v3/uniswap.v3.utils');
const { computeAggregatedVolumeFromPivot } = require('../utils/aggregator');


const DATA_DIR = process.cwd() + '/data';

let liquidityDataCache = {};
/**
 * Compute slippage data for a blockrange and target slippage array
 * @param {number[]} blockRange 
 * @param {number[]} targetSlippages
 */
async function precomputeUniswapV3Data(blockRange, targetSlippages, daysToFetch, blockTimeStamps) {
    console.log(`${fnName()}: Starting UNIV3 Precomputer for days to fetch: ${daysToFetch}`);

    const univ3PrecomputedDir = path.join(DATA_DIR, 'precomputed', 'uniswapv3');
    if(!fs.existsSync(univ3PrecomputedDir)) {
        fs.mkdirSync(univ3PrecomputedDir, {recursive: true});
    }

    // reset cache
    liquidityDataCache = {};
    
    const availablePairs = getAvailableUniswapV3(DATA_DIR);
    // console.log(availablePairs);

    for(const base of Object.keys(pairsToCompute)) {
        console.log('-------------------------------');
        console.log(`${fnName()}: Working on base ${base} with quotes: ${pairsToCompute[base].join(', ')}`);

        if(!availablePairs[base]) {
            console.log(`${fnName()}: ${base} is not in the available bases`);
            continue;
        }

        for (const quote of pairsToCompute[base]) {
            if(!availablePairs[base].includes(quote)) {
                console.log(`${fnName()}: ${quote} is not in the available quotes of ${base}`);
                continue;
            }

            console.log(`${fnName()}: will precompute base ${base}-${quote} data`);

            const fromToken = getConfTokenBySymbol(base);
            if(!fromToken) {
                throw new Error(`Could not find token with symbol ${base}`);
            }
            const toToken = getConfTokenBySymbol(quote);
            if(!toToken) {
                throw new Error(`Could not find token with symbol ${quote}`);
            }
            const start = Date.now();
            precomputeDataForPair(univ3PrecomputedDir, daysToFetch, blockRange, targetSlippages, fromToken, toToken);
            logFnDuration(start);
        }
    }

    concatenateFiles(daysToFetch, blockTimeStamps);

    console.log(`${fnName()}: Ending UNIV3 Precomputer for days to fetch: ${daysToFetch}`);
}

function precomputeDataForPair(univ3PrecomputedDir, daysToFetch, blockRange, targetSlippages, fromToken, toToken) {
    const destFileName = path.join(univ3PrecomputedDir,`${fromToken.symbol}-${toToken.symbol}_precomputed_${daysToFetch}d.json`);
    if(fs.existsSync(destFileName)) {
        fs.rmSync(destFileName);
    }
    
    const resultsForRange = getUniV3DataforBlockRange(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange);
    if(Object.keys(resultsForRange).length == 0)  {
        console.log(`${fnName()}: No data found for the last ${daysToFetch} day(s) for ${fromToken.symbol}/${toToken.symbol}`);
        return;
    }

    const preComputedData = {
        base: fromToken.symbol,
        quote: toToken.symbol,
        blockStep: blockRange[1] - blockRange[0],
    };

    const volumeForSlippage = [];

    const aggregatedVolumeForSlippage = computeAggregatedVolumeForSlippage(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange, targetSlippages, resultsForRange);

    let lastBlockValue = resultsForRange[Object.keys(resultsForRange)[0]];
    for(let i = 0; i < blockRange.length; i++) {
        const block = blockRange[i];
        let blockValue = resultsForRange[block];

        if(!blockValue) {
            blockValue = lastBlockValue;
        }

        lastBlockValue = blockValue;

        if(i == 0) {
            preComputedData.startPrice = blockValue.price;
        }

        if(i == blockRange.length -1) {
            preComputedData.endPrice = blockValue.price;
        }

        const liquidity = {};

        liquidity['price'] = blockValue.price;
        liquidity['blockNumber'] = Number(block);
        liquidity['realBlockNumber'] = blockValue.blockNumber;
        liquidity['realBlockNumberDistance'] = Math.abs(Number(block) - blockValue.blockNumber);
        liquidity['aggregated'] = {};

        for(const slippagePct of targetSlippages) {
            liquidity[slippagePct] = blockValue.slippageMap[slippagePct * 100];
            liquidity['aggregated'][slippagePct] = aggregatedVolumeForSlippage[block][slippagePct];
        }

        volumeForSlippage.push(liquidity);
    }

    preComputedData.volumeForSlippage = volumeForSlippage;

    preComputedData.parkinsonVolatility = computeUniv3ParkinsonVolatility(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange[0], blockRange.at(-1), daysToFetch);
    console.log(preComputedData.parkinsonVolatility);

    fs.writeFileSync(destFileName, JSON.stringify(preComputedData, null, 2));
}

const AGG_PIVOTS = ['USDC', 'WBTC', 'WETH'];
function computeAggregatedVolumeForSlippage(DATA_DIR, base, quote, blockRange, targetSlippages, baseDataHistoryDataPoints) {
    const aggregVolumeForBlock = {};
    for(const pivot of AGG_PIVOTS) {

        if([base, quote].includes(pivot)) {
            continue;
        }
    
        const segment1HistoryDataPoints = getUniV3DataforBlockRange(DATA_DIR, base, pivot, blockRange);
        const segment2HistoryDataPoints = getUniV3DataforBlockRange(DATA_DIR, pivot, quote, blockRange);
        for(const blockNumber of blockRange) {
            if(!aggregVolumeForBlock[blockNumber]) {
                aggregVolumeForBlock[blockNumber] = {};
            }
            const baseDataHistoryData = baseDataHistoryDataPoints[blockNumber];
            const segment1HistoryData = segment1HistoryDataPoints[blockNumber];
            const segment2HistoryData = segment2HistoryDataPoints[blockNumber];

            if(!baseDataHistoryData) {
                // if no base data for block, ignore
                continue;
            }
                
            if(!segment1HistoryData){
                // console.warn(`cannot find history data for ${base}/${pivot} at block ${blockNumber}`);
                continue;
            }

            if(!segment2HistoryData) {
                // console.warn(`cannot find history data for ${pivot}/${quote} at block ${blockNumber}`);
                continue;
            }

            for(const slippagePct of targetSlippages) {
                const targetSlippageBps = slippagePct * 100;
                if(!aggregVolumeForBlock[blockNumber][slippagePct]) {
                    aggregVolumeForBlock[blockNumber][slippagePct] = baseDataHistoryData.slippageMap[targetSlippageBps];
                    console.log(`base volume for ${base}->${quote}: ${aggregVolumeForBlock[blockNumber][slippagePct]} ${base}`);
                }
    
                const aggregVolume = computeAggregatedVolumeFromPivot(segment1HistoryData.slippageMap, segment1HistoryData.price, segment2HistoryData.slippageMap, targetSlippageBps);
                console.log(`adding aggreg volume ${aggregVolume} from route ${base}->${pivot}->${quote} for slippage ${slippagePct}`);
                aggregVolumeForBlock[blockNumber][slippagePct] += aggregVolume;
                console.log(`new aggreg volume for ${base}->${quote}: ${aggregVolumeForBlock[blockNumber][slippagePct]} for slippage ${slippagePct}`);
            }
        }
    }

    return aggregVolumeForBlock;
}

function concatenateFiles(daysToFetch, blockTimeStamps) {
    console.log(`${fnName()}: Creating concatenated file for UNIV3 and days to fetch: ${daysToFetch}`);
    const precomputeDir = path.join(DATA_DIR, 'precomputed', 'uniswapv3');
    const concatenatedFilename = path.join(precomputeDir, `concat-${daysToFetch}d.json-staging`);

    const filesToConcat = fs.readdirSync(precomputeDir).filter(_ => _.endsWith(`precomputed_${daysToFetch}d.json`) && !_.startsWith('concat-'));

    const allJsons = [];
    for(const file of filesToConcat) {
        const filepath = path.join(precomputeDir,file);
        const json = JSON.parse(fs.readFileSync(filepath));
        allJsons.push(json);
    }

    const concatObj = {
        lastUpdate: Date.now(),
        concatData: allJsons,
        blockTimestamps: blockTimeStamps
    };

    console.log(`${fnName()}: Writing concat file with ${allJsons.length} source data in it`);
    fs.writeFileSync(concatenatedFilename, JSON.stringify(concatObj));
    console.log(`${fnName()}: ${concatenatedFilename} file created`);
}
module.exports = { precomputeUniswapV3Data };