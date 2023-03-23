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
    // for (const file of files) {
    //     console.log('-------------------------------');
    //     console.log('PreComputer: starting on file', file);
    //     const filePath = DATA_DIR + '/uniswapv2/' + file;
    //     const pair = file.split('_')[0].split('-');

    //     const fromToken = tokens[pair[0]];
    //     if(!fromToken) {
    //         throw new Error(`Could not find token with symbol ${pair[0]}`);
    //     }
    //     const toToken = tokens[pair[1]];
    //     if(!toToken) {
    //         throw new Error(`Could not find token with symbol ${pair[1]}`);
    //     }

    //     // load the file in ram
    //     const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');
    //     for(let i = 1; i < fileContent.length - 1; i++) {

    //     }
    //     // remove first and last line
    //     let lastLine = fileContent[fileContent.length - 1];
    //     if (!lastLine) {
    //         // last line can be just \n so if lastline empty, check previous line
    //         lastLine = fileContent[fileContent.length - 2];
    //     }

    //     const lastBlockDataSplt = lastLine.split(',');
    //     const lastBlockNumber = Number(lastBlockDataSplt[0]);
    //     /// retrieve blockdata
    //     const results = await getUniV2DataforBlockRange('data', from, to, blockRange);
    //     /// compute liquidity
    //     const volumeForSlippage = [];
    //     for (const [block, value] of Object.entries(results)) {
    //         const liquidity = {};
    //         liquidity['blockNumber'] = block;
    //         for (let i = 0; i < targetSlippages.length; i++) {
    //             const normalizedFrom = normalize(value.fromReserve, tokens[from].decimals);
    //             const normalizedTo = normalize(value.toReserve, tokens[to].decimals);
    //             liquidity[targetSlippages[i]] = computeLiquidityUniV2Pool(from, normalizedFrom, to, normalizedTo, (targetSlippages[i]/100));
    //         }
    //         volumeForSlippage.push(liquidity);
    //     }
    //     // compute start and end price
    //     ///compute startPrice
    //     const startPrice = computePrice(from, to, results[blockRange[0]].fromReserve, results[blockRange[0]].toReserve);
    //     const endPrice = computePrice(from, to, results[blockRange.at(-1)].fromReserve, results[blockRange.at(-1)].toReserve);

    //     //writing data
    //     const preComputedData = {
    //         startPrice : startPrice,
    //         endPrice : endPrice, 
    //         volumeForSlippage : volumeForSlippage
    //     };

    //     fs.writeFileSync(`./data/precomputed/${from}-${to}_precomputed.json`, JSON.stringify(preComputedData));
    // }
}

function precomputeDataForPair(precomputedDirectory, daysToFetch, blockRange, targetSlippages,  fromToken, toToken) {
    console.log(`${fnName()}: computing data for ${fromToken.symbol}/${toToken.symbol}`);
    const resultsForRange = getUniV2DataforBlockRange(DATA_DIR, fromToken.symbol, toToken.symbol, blockRange);
    console.log(`${fnName()}: got ${Object.keys(resultsForRange).length} results for block range`);
    const volumeForSlippage = [];
    for (const [block, value] of Object.entries(resultsForRange)) {
        const liquidity = {};
        liquidity['blockNumber'] = Number(block);
        liquidity['realBlockNumberDistance'] = Math.abs(Number(block) - value.blockNumber);
        for (let i = 0; i < targetSlippages.length; i++) {
            const normalizedFrom = normalize(value.fromReserve, fromToken.decimals);
            const normalizedTo = normalize(value.toReserve, toToken.decimals);
            liquidity[targetSlippages[i]] = computeLiquidityUniV2Pool(normalizedFrom, normalizedTo, targetSlippages[i]/100);
        }
        volumeForSlippage.push(liquidity);
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

module.exports = { precomputeUniswapV2Data };