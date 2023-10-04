
const fs = require('fs');
const path = require('path');

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
 * Formula from
 * https://ethereum.stackexchange.com/a/107170/105194
 *  TL;DR:
    a = sqrt(pxy)/p - x
    where p is the target price to be maintained and x and y
    are the quantities of the two tokens in the pool before the trade takes place.
    and a is the amount of x I can sell to reach the price p
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
    const amountOfFromToSell = Math.sqrt(targetPrice * fromReserve * toReserve)/targetPrice - fromReserve;
    return amountOfFromToSell;
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
