const fs = require('fs');
const { normalize, getConfTokenBySymbol } = require('../utils/token.utils');
const { getAvailableUniswapV2, getUniV2DataforBlockRange, computeLiquidityUniV2Pool, computeUniswapV2Price } = require('../uniswap.v2/uniswap.v2.utils');
const { pairsToCompute } = require('./precomputer.config');
const { fnName, logFnDuration } = require('../utils/utils');
const path = require('path');
const { getAvailableCurve, getCurveDataforBlockRange, getReservesNormalizedTo18Decimals, computeLiquidityForSlippageCurvePool, get_return } = require('../curve/curve.utils');


const DATA_DIR = process.cwd() + '/data';
const BIGINT_1e18 = (BigInt(10) ** BigInt(18));
/**
 * Compute slippage data for a blockrange and target slippage array
 * @param {number[]} blockRange 
 * @param {number[]} targetSlippages
 */
async function precomputeCurveData(blockRange, targetSlippages, daysToFetch) {
    console.log(`${fnName()}: Starting CURVE Precomputer for days to fetch: ${daysToFetch}`);

    const curvePrecomputedDir = path.join(DATA_DIR, 'precomputed', 'curve');
    if(!fs.existsSync(curvePrecomputedDir)) {
        fs.mkdirSync(curvePrecomputedDir, {recursive: true});
    }

    
    const availablePairs = getAvailableCurve(DATA_DIR);
    // console.log(availablePairs);

    for(const base of Object.keys(pairsToCompute)) {
        console.log('-------------------------------');
        console.log(`${fnName()}: Working on base ${base} with quotes: ${pairsToCompute[base].join(', ')}`);

        if(!availablePairs[base]) {
            console.log(`${fnName()}: ${base} is not in the available bases`);
            continue;
        }

        for (const quote of pairsToCompute[base]) {
            if(!Object.keys(availablePairs[base]).includes(quote)) {
                console.log(`${fnName()}: ${quote} is not in the available quotes of ${base}`);
                continue;
            }

            const poolsForPair = Object.keys(availablePairs[base][quote]);
            console.log(`${fnName()}: Pools for pair ${base}/${quote}: ${poolsForPair.join(', ')}`);
            const fromToken = getConfTokenBySymbol(base);
            if(!fromToken) {
                throw new Error(`Could not find token with symbol ${base}`);
            }
            const toToken = getConfTokenBySymbol(quote);
            if(!toToken) {
                throw new Error(`Could not find token with symbol ${quote}`);
            }
            
            const start = Date.now();
            precomputeDataForPair(curvePrecomputedDir, daysToFetch, blockRange, targetSlippages, fromToken, toToken, poolsForPair);
            logFnDuration(start);
        }
    }

    concatenateFiles(daysToFetch);

    console.log(`${fnName()}: Ending CURVE Precomputer for days to fetch: ${daysToFetch}`);
}

function precomputeDataForPair(precomputedDirectory, daysToFetch, blockRange, targetSlippages, fromToken, toToken, targetPools) {
    console.log(`${fnName()}: Will precompute data from pools ${targetPools.join(', ')} for days to fetch: ${daysToFetch}`);
    
    const destFileName = path.join(precomputedDirectory,`${fromToken.symbol}-${toToken.symbol}_precomputed_${daysToFetch}d.json`);
    if(fs.existsSync(destFileName)) {
        fs.rmSync(destFileName);
    }

    const volumeForSlippage = [];
    const startPrices = [];
    const endPrices = [];

    for(const poolName of targetPools) {
        console.log(`${fnName()}: Start working on ${poolName}`);

        const resultsForRange = getCurveDataforBlockRange(DATA_DIR, poolName, blockRange);
        if(Object.keys(resultsForRange).length == 0)  {
            console.log(`${fnName()}: No data found for the last ${daysToFetch} day(s) in pool ${poolName}`);
            return;
        }

        console.log(`${fnName()}: got ${Object.keys(resultsForRange).length} results for block range`);
        // init lastBlockValue as the first result returned in 'resultsForRange'
        let lastBlockValue = resultsForRange.reserves[Object.keys(resultsForRange.reserves)[0]];
        const tokens = [];
        for (const token of resultsForRange.tokens) {
            tokens.push(getConfTokenBySymbol(token));
        }
        
        const indexFrom = resultsForRange.tokens.indexOf(fromToken.symbol);
        const indexTo = resultsForRange.tokens.indexOf(toToken.symbol);

        for(let i = 0; i < blockRange.length; i++) {
            const block = blockRange[i];
            let blockValue = resultsForRange.reserves[block];

            if(!blockValue) {
                blockValue = lastBlockValue;
            }
            
            const liquidity = {};
            liquidity['blockNumber'] = Number(block);
            liquidity['realBlockNumber'] = blockValue.blockNumber;
            liquidity['realBlockNumberDistance'] = Math.abs(Number(block) - blockValue.blockNumber);
            
            const reservesNorm18Dec = getReservesNormalizedTo18Decimals(tokens, blockValue.reserves);
            const basePrice = normalize(get_return(indexFrom, indexTo, BIGINT_1e18, reservesNorm18Dec, blockValue.ampFactor).toString(), 18);
            if(i == 0) {
                startPrices.push(basePrice);
            }

            if(i == blockRange.length - 1) {
                endPrices.push(basePrice);
            }

            for (let j = 0; j < targetSlippages.length; j++) {

                const targetSlippage = targetSlippages[j];
                const targetPrice = basePrice - (basePrice * targetSlippage / 100);
                const liquidityAtSlippage = normalize(computeLiquidityForSlippageCurvePool(fromToken.symbol, toToken.symbol, BIGINT_1e18, targetPrice, reservesNorm18Dec, indexFrom, indexTo, blockValue.ampFactor).toString(), 18);
                
                liquidity[targetSlippages[j]] = liquidityAtSlippage;
            }

            volumeForSlippage.push(liquidity);
            lastBlockValue = blockValue;
        }
    }

    const aggregVolumeForSlippage = [];
    // here we must sum all the volumes for slippage
    for(let i = 0; i < blockRange.length; i++) {
        const block = blockRange[i];
        const allValuesForSameBlock = volumeForSlippage.filter(_ => _.blockNumber == block);

        const aggregVolume = {
            blockNumber: block,
            realBlockNumber: block,
            realBlockNumberDistance: 0
        };
        
        for(const slippage of targetSlippages) {
            aggregVolume[slippage] = allValuesForSameBlock.reduce((accumulator, currentValue) => { return accumulator + currentValue[slippage]; }, 0);
        }

        aggregVolumeForSlippage.push(aggregVolume);
    }

    const startPrice = startPrices.reduce((accumulator, currentValue) => { return accumulator + currentValue; }, 0) / startPrices.length;
    const endPrice = endPrices.reduce((accumulator, currentValue) => { return accumulator + currentValue; }, 0) / startPrices.length;
    
    const preComputedData = {
        base: fromToken.symbol,
        quote: toToken.symbol,
        blockStep: blockRange[1] - blockRange[0],
        startPrice: startPrice,
        endPrice : endPrice,         
        volumeForSlippage : aggregVolumeForSlippage
    };

    fs.writeFileSync(destFileName, JSON.stringify(preComputedData, null, 2));
}

function concatenateFiles(daysToFetch) {
    console.log(`${fnName()}: Creating concatenated file for CURVE and days to fetch: ${daysToFetch}`);
    const precomputeDir = path.join(DATA_DIR, 'precomputed', 'curve');
    const concatenatedFilename = path.join(precomputeDir, `concat-${daysToFetch}d.json`);

    const filesToConcat = fs.readdirSync(precomputeDir).filter(_ => _.endsWith(`precomputed_${daysToFetch}d.json`) && !_.startsWith('concat-'));

    const allJsons = [];
    for(const file of filesToConcat) {
        const filepath = path.join(precomputeDir,file);
        const json = JSON.parse(fs.readFileSync(filepath));
        allJsons.push(json);
    }

    const concatObj = {
        lastUpdate: Date.now(),
        concatData: allJsons
    };

    console.log(`${fnName()}: Writing concat file with ${allJsons.length} source data in it`);
    fs.writeFileSync(concatenatedFilename, JSON.stringify(concatObj));
    console.log(`${fnName()}: ${concatenatedFilename} file created`);
}

module.exports = { precomputeCurveData };

// precomputeCurveData([16896464], [1, 5, 10, 15, 20], 1);