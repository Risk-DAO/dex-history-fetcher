const fs = require('fs');
const { normalize, getConfTokenBySymbol } = require('../utils/token.utils');
const { getAvailableUniswapV2, getUniV2DataforBlockRange, computeLiquidityUniV2Pool, computeUniswapV2Price } = require('../uniswap.v2/uniswap.v2.utils');
const { pairsToCompute } = require('./precomputer.config');
const { fnName, logFnDuration } = require('../utils/utils');
const path = require('path');


const DATA_DIR = process.cwd() + '/data';

/**
 * Compute slippage data for a blockrange and target slippage array
 * @param {number[]} blockRange 
 * @param {number[]} targetSlippages
 */
async function precomputeUniswapV2Data(blockRange, targetSlippages, daysToFetch) {
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
    concatenateFiles(daysToFetch);
    console.log(`${fnName()}: Ending UNIV2 Precomputer for days to fetch: ${daysToFetch}`);
}

function precomputeDataForPair(precomputedDirectory, daysToFetch, blockRange, targetSlippages,  fromToken, toToken) {
    console.log(`${fnName()}: computing data for ${fromToken.symbol}/${toToken.symbol}`);
    const resultsForRange = getUniV2DataforBlockRange(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange);
    if(Object.keys(resultsForRange).length == 0)  {
        console.log(`${fnName()}: No data found for the last ${daysToFetch} day(s) for ${fromToken.symbol}/${toToken.symbol}`);
        return;
    }

    console.log(`${fnName()}: got ${Object.keys(resultsForRange).length} results for block range`);
    const volumeForSlippage = [];
    for (const [block, value] of Object.entries(resultsForRange)) {
        const liquidity = {};
        liquidity['blockNumber'] = Number(block);
        liquidity['realBlockNumber'] = value.blockNumber;
        liquidity['blockNumberDistance'] = Math.abs(Number(block) - value.blockNumber);
        for (let i = 0; i < targetSlippages.length; i++) {
            const normalizedFrom = normalize(value.fromReserve, fromToken.decimals);
            const normalizedTo = normalize(value.toReserve, toToken.decimals);
            liquidity[targetSlippages[i]] = computeLiquidityUniV2Pool(normalizedFrom, normalizedTo, targetSlippages[i]/100);
        }
        volumeForSlippage.push(liquidity);
    }

    // if any empty blocks, fill with 0 ?
    for(let i = 0; i< blockRange.length; i++) {
        const block = blockRange[i];
        if(!resultsForRange[block]) {
            
            const liquidity = {};
            liquidity['blockNumber'] = Number(block);
            liquidity['realBlockNumberDistance'] = -1;
            for (let i = 0; i < targetSlippages.length; i++) {
                liquidity[targetSlippages[i]] = 0;
            }
            volumeForSlippage.push(liquidity);
        }
    }


    const firstKey = Object.keys(resultsForRange)[0];
    const lastKey = Object.keys(resultsForRange)[Object.keys(resultsForRange).length - 1];

    const startPrice = computeUniswapV2Price(normalize(resultsForRange[firstKey].fromReserve, fromToken.decimals), normalize(resultsForRange[firstKey].toReserve, toToken.decimals));
    const endPrice = computeUniswapV2Price(normalize(resultsForRange[lastKey].fromReserve, fromToken.decimals), normalize(resultsForRange[lastKey].toReserve, toToken.decimals));

    const preComputedData = {
        blockStep: blockRange[1] - blockRange[0],
        startPrice: startPrice,
        endPrice : endPrice, 
        volumeForSlippage : volumeForSlippage
    };

    fs.writeFileSync(path.join(precomputedDirectory,`${fromToken.symbol}-${toToken.symbol}_precomputed_${daysToFetch}d.json`), JSON.stringify(preComputedData, null, 2));
}

function concatenateFiles(daysToFetch) {
    console.log(`${fnName()}: Creating concatenated file for UNIV2 and days to fetch: ${daysToFetch}`);
    const precomputeDir = path.join(DATA_DIR, 'precomputed', 'uniswapv2');
    const concatenatedFilename = path.join(precomputeDir, `concat-${daysToFetch}d.json`);

    const filesToConcat = fs.readdirSync(precomputeDir).filter(_ => _.endsWith(`precomputed_${daysToFetch}d.json`) && !_.startsWith('concat-'));

    const allJsons = [];
    for(const file of filesToConcat) {
        const filepath = path.join(precomputeDir,file);
        const json = JSON.parse(fs.readFileSync(filepath));
        const base = file.split('_')[0].split('-')[0];
        const quote = file.split('_')[0].split('-')[1];
        json.base = base;
        json.quote = quote;
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

module.exports = { precomputeUniswapV2Data };