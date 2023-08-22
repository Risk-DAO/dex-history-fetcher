
const fs = require('fs');
const readline = require('readline');
const { normalize } = require('../utils/token.utils');
const { tokens } = require('../global.config');
const { BigNumber } = require('ethers');
const path = require('path');
const { fnName } = require('../utils/utils');
const { computeParkinsonVolatility } = require('../utils/volatility');


function getSushiV2DataFile(dataDir, fromSymbol, toSymbol) {
    let filePath = path.join(dataDir, 'sushiswapv2', `${fromSymbol}-${toSymbol}_sushiswapv2.csv`);
    let reverse = false;

    if(fs.existsSync(filePath)) {
        return {
            path: filePath,
            reverse: reverse
        };
    } else {
        filePath = path.join(dataDir, 'sushiswapv2',`${toSymbol}-${fromSymbol}_sushiswapv2.csv`);
        reverse = true;
        if(fs.existsSync(filePath)) {
            return {
                path: filePath,
                reverse: reverse
            };
        } else {
            return null;
        }
    }
}

function getSushiV2DataforBlockInterval(DATA_DIR, fromSymbol, toSymbol, fromBlock, toBlock) {
    const fileInfo = getSushiV2DataFile(DATA_DIR, fromSymbol, toSymbol);
    if(!fileInfo) {
        throw new Error(`Could not find pool data for ${fromSymbol}/${toSymbol} on sushiswapv2`);
    }
    // load the file in RAM
    const fileContent = fs.readFileSync(fileInfo.path, 'utf-8').split('\n');

    const results = {};
    // start at 2 because first line is headers and second is in lastLine
    for(let i = 1; i < fileContent.length - 1; i++) {
        const line = fileContent[i];
        const splitted = line.split(',');
        const blockNumber = Number(splitted[0]);
        if(blockNumber < fromBlock) {
            continue;
        }

        if (blockNumber > toBlock) {
            break;
        }

        results[blockNumber] = {
            blockNumber: blockNumber,
            fromReserve: fileInfo.reverse ? splitted[2] : splitted[1],
            toReserve: fileInfo.reverse ? splitted[1] : splitted[2]
        };
    }

    return results;
}
/**
 * compute the liquidity of a token to another, using the reserves of one pool and a target slippage
 *  with the following formula: 
 *  a = (y / e) - x
 *  with :
 *      a = amount of token from we can exchange to achieve target slippage,
 *      y = reserve to,
 *      e = target price and
 *      x = reserve from
 * @param {string} fromSymbol 
 * @param {number} fromReserve must be normalized with correct decimal place
 * @param {string} toSymbol 
 * @param {number} toReserve must be normalized with correct decimal place
 * @param {number} targetSlippage 
 * @returns {number} amount of token exchangeable for defined slippage
 */
function computeLiquiditySushiV2Pool(fromReserve, toReserve, targetSlippage) {
    if(fromReserve == 0) {
        return 0;
    }
    
    const initPrice = toReserve / fromReserve;
    const targetPrice = initPrice - (initPrice * targetSlippage);
    const amountOfFromToExchange = (toReserve / targetPrice) - fromReserve;
    return amountOfFromToExchange;
}

function computeSushiswapV2Price(normalizedFrom, normalizedTo) {
    if(normalizedFrom == 0) {
        return 0;
    }
    return  normalizedTo / normalizedFrom;
}

function getAvailableSushiswapV2(dataDir) {
    const available = {};
    const dirPath = path.join(dataDir, 'sushiswapv2');
    const files = fs.readdirSync(dirPath).filter(_ => _.endsWith('.csv'));
    for(const file of files) {
        const pair = file.split('_')[0];

        const tokenA = pair.split('-')[0];
        const tokenB = pair.split('-')[1];
        if(!available[tokenA]) {
            available[tokenA] = [];
        }
        if(!available[tokenB]) {
            available[tokenB] = [];
        }
        available[tokenA].push(tokenB);
        available[tokenB].push(tokenA);
    }

    return available;
}

module.exports = { getAvailableSushiswapV2, computeSushiswapV2Price, computeLiquiditySushiV2Pool, getSushiV2DataforBlockInterval};
