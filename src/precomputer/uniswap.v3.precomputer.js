const fs = require('fs');
const { getConfTokenBySymbol } = require('../utils/token.utils');
const { pairsToCompute } = require('./precomputer.config');
const { fnName, logFnDuration } = require('../utils/utils');
const path = require('path');
const { getAvailableUniswapV3, getUniV3DataforBlockRange } = require('../uniswap.v3/uniswap.v3.utils');


const DATA_DIR = process.cwd() + '/data';

/**
 * Compute slippage data for a blockrange and target slippage array
 * @param {number[]} blockRange 
 * @param {number[]} targetSlippages
 */
async function precomputeUniswapV3Data(blockRange, targetSlippages, daysToFetch) {
    console.log(`${fnName()}: Starting UNIV3 Precomputer for days to fetch: ${daysToFetch}`);

    const univ3PrecomputedDir = path.join(DATA_DIR, 'precomputed', 'uniswapv3');
    if(!fs.existsSync(univ3PrecomputedDir)) {
        fs.mkdirSync(univ3PrecomputedDir, {recursive: true});
    }

    
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

    concatenateFiles(daysToFetch);

    console.log(`${fnName()}: Ending UNIV3 Precomputer for days to fetch: ${daysToFetch}`);
}

function precomputeDataForPair(univ3PrecomputedDir, daysToFetch, blockRange, targetSlippages, fromToken, toToken) {
    const resultsForRange = getUniV3DataforBlockRange(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange);
    if(Object.keys(resultsForRange).length == 0)  {
        console.log(`${fnName()}: No data found for the last ${daysToFetch} day(s) for ${fromToken.symbol}/${toToken.symbol}`);
        return;
    }

    const destFileName = path.join(univ3PrecomputedDir,`${fromToken.symbol}-${toToken.symbol}_precomputed_${daysToFetch}d.json`);
    
    const preComputedData = {
        base: fromToken.symbol,
        quote: toToken.symbol,
        blockStep: blockRange[1] - blockRange[0],
    };

    const volumeForSlippage = [];

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

        for(const slippagePct of targetSlippages) {
            liquidity[slippagePct] = blockValue.slippageMap[slippagePct];
        }

        volumeForSlippage.push(liquidity);
    }

    preComputedData.volumeForSlippage = volumeForSlippage;
    fs.writeFileSync(destFileName, JSON.stringify(preComputedData, null, 2));
}

function concatenateFiles(daysToFetch) {
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
        concatData: allJsons
    };

    console.log(`${fnName()}: Writing concat file with ${allJsons.length} source data in it`);
    fs.writeFileSync(concatenatedFilename, JSON.stringify(concatObj));
    console.log(`${fnName()}: ${concatenatedFilename} file created`);
}
module.exports = { precomputeUniswapV3Data };