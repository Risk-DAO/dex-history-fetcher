
const fs = require('fs');
const path = require('path');

/**
 * Compute price from normalized reserves
 * @param {number} normalizedFrom 
 * @param {number} normalizedTo 
 * @returns 
 */
function computeUniswapV2Price(normalizedFrom, normalizedTo) {
    if(normalizedFrom == 0) {
        return 0;
    }
    return  normalizedTo / normalizedFrom;
}

/**
 * Try to find the univ2 data file for fromSymbol/toSymbol
 * Return all the data we have since fromBlock to toBlock
 * @param {string} DATA_DIR 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{[blocknumber: number]: {fromReserve: string, toReserve: string}}}
 */
function getUniV2DataforBlockInterval(DATA_DIR, fromSymbol, toSymbol, fromBlock, toBlock) {
    const fileInfo = getUniV2DataFile(DATA_DIR, fromSymbol, toSymbol);
    if(!fileInfo) {
        throw new Error(`Could not find pool data for ${fromSymbol}/${toSymbol} on uniswapv2`);
    }
    // load the file in RAM
    const fileContent = fs.readFileSync(fileInfo.path, 'utf-8').split('\n');

    const results = {};
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
            fromReserve: fileInfo.reverse ? splitted[2] : splitted[1],
            toReserve: fileInfo.reverse ? splitted[1] : splitted[2]
        };
    }

    return results;
}

/**
 * Return the file found for fromSymbol/toSymbol
 * Example if requesting WETH/USDC and the file is USDC-WETH.csv,
 * this function still returns the USDC-WETH.csv file but specify reverse = true
 * meaning that we should read the reserves as reversed
 * @param {string} dataDir 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @returns 
 */
function getUniV2DataFile(dataDir, fromSymbol, toSymbol) {
    let filePath = path.join(dataDir, 'uniswapv2', `${fromSymbol}-${toSymbol}_uniswapv2.csv`);
    let reverse = false;

    if(fs.existsSync(filePath)) {
        return {
            path: filePath,
            reverse: reverse
        };
    } else {
        filePath = path.join(dataDir, 'uniswapv2',`${toSymbol}-${fromSymbol}_uniswapv2.csv`);
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
function computeLiquidityUniV2Pool(fromReserve, toReserve, targetSlippage) {
    if(fromReserve == 0) {
        return 0;
    }
    
    const initPrice = toReserve / fromReserve;
    const targetPrice = initPrice - (initPrice * targetSlippage);
    const amountOfFromToExchange = (toReserve / targetPrice) - fromReserve;
    return amountOfFromToExchange;
}

/**
 * Read all the csv files to check what pairs are available
 * @param {string} dataDir 
 * @returns {{[base: string]: string[]}}
 */
function getAvailableUniswapV2(dataDir) {
    const available = {};
    const files = fs.readdirSync(`${dataDir}/uniswapv2/`).filter(_ => _.endsWith('.csv'));
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

module.exports = { computeUniswapV2Price, computeLiquidityUniV2Pool, getAvailableUniswapV2, getUniV2DataforBlockInterval };
