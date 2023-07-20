const fs = require('fs');
const { normalize, getConfTokenBySymbol } = require('../utils/token.utils');
const { getAvailableUniswapV2, getUniV2DataforBlockRange, computeLiquidityUniV2Pool, computeUniswapV2Price, computeUniv2ParkinsonVolatility } = require('../uniswap.v2/uniswap.v2.utils');
const { pairsToCompute } = require('./precomputer.config');
const { fnName, logFnDuration } = require('../utils/utils');
const path = require('path');
const { computeAggregatedVolumeFromPivot } = require('../utils/aggregator');
const { tokens } = require('../global.config');


const DATA_DIR = process.cwd() + '/data';

/**
 * Compute slippage data for a blockrange and target slippage array
 * @param {number[]} blockRange 
 * @param {number[]} targetSlippages
 */
async function precomputeUniswapV2Data(blockRange, targetSlippages, daysToFetch, blockTimeStamps) {
    console.log(`${fnName()}: Starting UNIV2 Precomputer for days to fetch: ${daysToFetch}`);
    const uniV2precomputedDir = path.join(DATA_DIR, 'precomputed', 'uniswapv2');
    if(!fs.existsSync(uniV2precomputedDir)) {
        fs.mkdirSync(uniV2precomputedDir, {recursive: true});
    }

    const availablePairs = getAvailableUniswapV2(DATA_DIR);
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
            precomputeDataForPair(uniV2precomputedDir, daysToFetch, blockRange, targetSlippages, fromToken, toToken);
            logFnDuration(start);
        }
    }

    // create a concatenated file
    concatenateFiles(daysToFetch, blockTimeStamps);
    console.log(`${fnName()}: Ending UNIV2 Precomputer for days to fetch: ${daysToFetch}`);
}

function precomputeDataForPair(precomputedDirectory, daysToFetch, blockRange, targetSlippages,  fromToken, toToken) {
    const destFileName = path.join(precomputedDirectory,`${fromToken.symbol}-${toToken.symbol}_precomputed_${daysToFetch}d.json`);
    if(fs.existsSync(destFileName)) {
        fs.rmSync(destFileName);
    }

    console.log(`${fnName()}: computing data for ${fromToken.symbol}/${toToken.symbol}`);
    const resultsForRange = getUniV2DataforBlockRange(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange);
    
    if(!resultsForRange || Object.keys(resultsForRange).length == 0)  {
        console.log(`${fnName()}: No data found for the last ${daysToFetch} day(s) for ${fromToken.symbol}/${toToken.symbol}`);
        return;
    }


    console.log(`${fnName()}: got ${Object.keys(resultsForRange).length} results for block range`);

    const aggregatedVolumeForSlippage = computeAggregatedVolumeForSlippage(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange, targetSlippages, resultsForRange);

    // init lastBlockValue as the first result returned in 'resultsForRange'
    let lastBlockValue = resultsForRange[Object.keys(resultsForRange)[0]];
    const volumeForSlippage = [];
    for(const block of blockRange) {
        let blockValue = resultsForRange[block];

        if(!blockValue) {
            blockValue = lastBlockValue;
        }
        
        const liquidity = {};
        liquidity['blockNumber'] = Number(block);
        liquidity['realBlockNumber'] = blockValue.blockNumber;
        liquidity['realBlockNumberDistance'] = Math.abs(Number(block) - blockValue.blockNumber);
        
        const normalizedFrom = normalize(blockValue.fromReserve, fromToken.decimals);
        const normalizedTo = normalize(blockValue.toReserve, toToken.decimals);

        liquidity['price'] = computeUniswapV2Price(normalizedFrom, normalizedTo);
        liquidity['aggregated'] = {};

        for(const slippage of targetSlippages) {
            liquidity[slippage] = computeLiquidityUniV2Pool(normalizedFrom, normalizedTo, slippage/100);
            liquidity['aggregated'][slippage] = aggregatedVolumeForSlippage[block] ? aggregatedVolumeForSlippage[block][slippage] : liquidity[slippage];
        }
        
        volumeForSlippage.push(liquidity);
        lastBlockValue = blockValue;
    }

    const firstKey = Object.keys(resultsForRange)[0];
    const lastKey = Object.keys(resultsForRange)[Object.keys(resultsForRange).length - 1];

    const startPrice = computeUniswapV2Price(normalize(resultsForRange[firstKey].fromReserve, fromToken.decimals), normalize(resultsForRange[firstKey].toReserve, toToken.decimals));
    const endPrice = computeUniswapV2Price(normalize(resultsForRange[lastKey].fromReserve, fromToken.decimals), normalize(resultsForRange[lastKey].toReserve, toToken.decimals));

    const preComputedData = {
        base: fromToken.symbol,
        quote: toToken.symbol,
        blockStep: blockRange[1] - blockRange[0],
        startPrice: startPrice,
        endPrice : endPrice,         
        volumeForSlippage : volumeForSlippage
    };

    preComputedData.parkinsonVolatility = computeUniv2ParkinsonVolatility(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange[0], blockRange.at(-1), daysToFetch);

    fs.writeFileSync(destFileName, JSON.stringify(preComputedData, null, 2));
}


const AGG_PIVOTS = ['USDC', 'WBTC', 'WETH'];
function computeAggregatedVolumeForSlippage(DATA_DIR, base, quote, blockRange, targetSlippages, baseDataHistoryDataPoints) {
    const baseToken = getConfTokenBySymbol(base);
    const quoteToken = getConfTokenBySymbol(quote);
    const aggregVolumeForBlock = {};
    for(const pivot of AGG_PIVOTS) {

        if([base, quote].includes(pivot)) {
            continue;
        }

        const pivotToken = getConfTokenBySymbol(pivot);
    
        const segment1HistoryDataPoints = getUniV2DataforBlockRange(DATA_DIR, base, pivot, blockRange);
        if(!segment1HistoryDataPoints) {
            continue;
        }
        const segment2HistoryDataPoints = getUniV2DataforBlockRange(DATA_DIR, pivot, quote, blockRange);
        if(!segment2HistoryDataPoints) {
            continue;
        }

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

            const segment1SlippageMap = {};
            const segment2SlippageMap = {};

            const normalizedFromSeg1 = normalize(segment1HistoryData.fromReserve, baseToken.decimals);
            const normalizedToSeg1 = normalize(segment1HistoryData.toReserve, pivotToken.decimals);
            const normalizedFromSeg2 = normalize(segment2HistoryData.fromReserve, pivotToken.decimals);
            const normalizedToSeg2 = normalize(segment2HistoryData.toReserve, quoteToken.decimals);
            
            const segment1Price = computeUniswapV2Price(normalizedFromSeg1, normalizedToSeg1);
            // create the slippage maps for the two segments
            for(let slippageBps = 50; slippageBps <= Math.max(...targetSlippages) * 100; slippageBps += 50) {
                
                segment1SlippageMap[slippageBps] = computeLiquidityUniV2Pool(normalizedFromSeg1, normalizedToSeg1, slippageBps/10000);
                
                segment2SlippageMap[slippageBps] = computeLiquidityUniV2Pool(normalizedFromSeg2, normalizedToSeg2, slippageBps/10000);
            }
            

            for(const slippagePct of targetSlippages) {

                if(!aggregVolumeForBlock[blockNumber][slippagePct]) {
                    const normalizedFrom = normalize(baseDataHistoryData.fromReserve, baseToken.decimals);
                    const normalizedTo = normalize(baseDataHistoryData.toReserve, quoteToken.decimals);
                    aggregVolumeForBlock[blockNumber][slippagePct] = computeLiquidityUniV2Pool(normalizedFrom, normalizedTo, slippagePct/100);
                    console.log(`base volume for ${base}->${quote}: ${aggregVolumeForBlock[blockNumber][slippagePct]} ${base}`);
                }
    
                const aggregVolume = computeAggregatedVolumeFromPivot(segment1SlippageMap, segment1Price, segment2SlippageMap, slippagePct * 100);
                console.log(`adding aggreg volume ${aggregVolume} from route ${base}->${pivot}->${quote} for slippage ${slippagePct}`);
                aggregVolumeForBlock[blockNumber][slippagePct] += aggregVolume;
                console.log(`new aggreg volume for ${base}->${quote}: ${aggregVolumeForBlock[blockNumber][slippagePct]} for slippage ${slippagePct}`);
            }
        }
    }

    return aggregVolumeForBlock;
}

function concatenateFiles(daysToFetch, blockTimeStamps) {
    console.log(`${fnName()}: Creating concatenated file for UNIV2 and days to fetch: ${daysToFetch}`);
    const precomputeDir = path.join(DATA_DIR, 'precomputed', 'uniswapv2');
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

module.exports = { precomputeUniswapV2Data };