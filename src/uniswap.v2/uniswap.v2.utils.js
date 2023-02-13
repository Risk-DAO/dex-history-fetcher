
const fs = require('fs');
const readline = require('readline');
const { normalize } = require('../utils/token.utils');
const { tokens } = require('../global.config');

async function getUniswapPriceAndLiquidity(dataDir, fromSymbol, toSymbol, targetBlockNumber) {
    const liquidityAtBlock = await getUniV2DataForBlockNumber(dataDir, fromSymbol, toSymbol, targetBlockNumber);
    const normalizedFrom = normalize(liquidityAtBlock.fromReserve, tokens[fromSymbol].decimals);
    const normalizedTo = normalize(liquidityAtBlock.toReserve, tokens[toSymbol].decimals);
    const price = normalizedTo / normalizedFrom;

    const result = {
        closestBlock: liquidityAtBlock.blockNumber,
        from: liquidityAtBlock.from,
        to: liquidityAtBlock.to,
        priceAtBlock: price,
        slippageMap: {}
    };

    for(let i = 1; i < 100; i++) {
        const targetSlippage = i/100;
        const liquidityForSlippage = computeLiquidityUniV2Pool(fromSymbol, normalizedFrom, toSymbol, normalizedTo, targetSlippage);
        result.slippageMap[i] = liquidityForSlippage;
    }

    return result;

}

async function getUniV2PriceForBlockNumber(dataDir, fromSymbol, toSymbol, targetBlockNumber) {
    const liquidityAtBlock = await getUniV2DataForBlockNumber(dataDir, fromSymbol, toSymbol, targetBlockNumber);

    const normalizedFrom = normalize(liquidityAtBlock.fromReserve, 18);
    const normalizedTo = normalize(liquidityAtBlock.toReserve, 6);
    const price = normalizedTo / normalizedFrom;
    return price;
}

async function getUniV2DataForBlockNumber(dataDir, fromSymbol, toSymbol, targetBlockNumber) {
    const fileInfo = getUniV2DataFile(dataDir, fromSymbol, toSymbol);
    if(!fileInfo) {
        throw new Error(`Could not find pool data for ${fromSymbol}/${toSymbol} on uniswapv2`);
    }
    
    const fileStream = fs.createReadStream(fileInfo.path);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });


    let first = true;
    let selectedValue = {};
    for await (const line of rl) {
        if(first) {
            first = false;
        } else {
            const splitted = line.split(',');
            const blockNumber = Number(splitted[0]);
            const reserve0 = splitted[1];
            const reserve1 = splitted[2];

            if(blockNumber == targetBlockNumber) {
                // stop loop we found the exact block number
                selectedValue = {
                    blockNumber,
                    reserve0,
                    reserve1
                };
                break; 
            } else if(blockNumber > targetBlockNumber) {
                // if the current block number is superior than the target block number
                // check which one is the closest: the last selected value or the current?
                const distanceFromLast = Math.abs(targetBlockNumber - selectedValue.blockNumber);
                const distanceFromCurrent =  Math.abs(targetBlockNumber - blockNumber);
                // take the smallest
                if(distanceFromLast > distanceFromCurrent) {
                    selectedValue = {
                        blockNumber,
                        reserve0,
                        reserve1
                    };
                }
                // here we break, returning either the current value or the last one
                break; 
            }
            // by default just save the last value as selected value
            selectedValue = {
                blockNumber,
                reserve0,
                reserve1
            };
        }
        // console.log('line:', line);    

    }

    fileStream.close();

    const liquidityValueAtBlock = {
        blockNumber: selectedValue.blockNumber,
        from: fromSymbol,
        to: toSymbol,
    };

    if(fileInfo.reverse) {
        liquidityValueAtBlock.fromReserve = selectedValue.reserve1;
        liquidityValueAtBlock.toReserve = selectedValue.reserve0;
    } else {
        liquidityValueAtBlock.fromReserve = selectedValue.reserve0;
        liquidityValueAtBlock.toReserve = selectedValue.reserve1;
    }

    return liquidityValueAtBlock;
}

function getUniV2DataFile(dataDir, fromSymbol, toSymbol) {
    let path = `${dataDir}/${fromSymbol}-${toSymbol}_uniswapv2.csv`;
    let reverse = false;

    if(fs.existsSync(path)) {
        return {
            path: path,
            reverse: reverse
        };
    } else {
        path = `${dataDir}/${toSymbol}-${fromSymbol}_uniswapv2.csv`;
        reverse = true;
        if(fs.existsSync(path)) {
            return {
                path: path,
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
function computeLiquidityUniV2Pool(fromSymbol, fromReserve, toSymbol, toReserve, targetSlippage) {
    console.log(`computeLiquidity: Calculating liquidity from ${fromSymbol} to ${toSymbol} with slippage ${Math.round(targetSlippage * 100)} %`);

    const initPrice = toReserve / fromReserve;
    const targetPrice = initPrice - (initPrice * targetSlippage);
    console.log(`computeLiquidity: initPrice: ${initPrice}, targetPrice: ${targetPrice}`);
    const amountOfFromToExchange = (toReserve / targetPrice) - fromReserve;
    console.log(`computeLiquidity: ${fromSymbol}/${toSymbol} liquidity: ${amountOfFromToExchange} ${fromSymbol}`);
    return amountOfFromToExchange;
}

module.exports = { getUniswapPriceAndLiquidity };

async function test() {
    // computeLiquidityUniV2Pool('ETH', 28345.5, 'USDC', 43920629, 10/100 );
    const start = Date.now();
    console.log(await getUniswapPriceAndLiquidity('./data', 'ETH', 'USDC', 16597701));
    console.log('duration', Date.now() - start);
}

// test();