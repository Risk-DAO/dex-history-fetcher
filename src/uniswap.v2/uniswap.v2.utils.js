
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
function computeLiquidityUniV2Pool(fromReserve, toReserve, targetSlippage) {
    if(fromReserve == 0) {
        return 0;
    }

    const initPrice = toReserve / fromReserve;
    const targetPrice = initPrice - (initPrice * targetSlippage);
    const amountOfFromToSell = Math.sqrt(targetPrice * fromReserve * toReserve)/targetPrice - fromReserve;
    
    // const yReceived = calculateYReceived(fromReserve, toReserve, amountOfFromToExchange);
    // const newFromReserve = fromReserve + amountOfFromToExchange;
    // const newToReserve = toReserve - yReceived;
    // const newPrice = newToReserve / newFromReserve;
    // console.log({initPrice});
    // console.log({targetPrice});
    // console.log({newPrice});
    // console.log(`diff wanted: ${targetSlippage * 100}%`);
    // const priceDiff = (initPrice - newPrice) / initPrice;
    // console.log(`real diff for the new price: ${priceDiff*100}%`);
    return amountOfFromToSell;
}

// used for verifications
function calculateYReceived(x0, y0, xSell) {
    // Initial state of the liquidity pool
    const k0 = x0 * y0;
    // Calculate the new quantity of asset X after the sale (it increases)
    const x1 = x0 + xSell;
    // Calculate the new quantity of asset Y using the x * y = k formula
    const y1 = k0 / x1;
    // Calculate the difference in asset Y received
    const deltaY = y0 - y1;
    return deltaY;
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
