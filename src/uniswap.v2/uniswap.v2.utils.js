
const fs = require('fs');
const readline = require('readline');
const { normalize } = require('../utils/token.utils');
const { tokens } = require('../global.config');
const { BigNumber } = require('ethers');
const path = require('path');
const { fnName } = require('../utils/utils');

async function getUniswapAveragePriceAndLiquidity(dataDir, fromSymbol, toSymbol, fromBlock, toBlock) {
    const aggregatedLiquidity = await getUniV2AggregatedDataForBlockNumbers(dataDir, fromSymbol, toSymbol, fromBlock, toBlock);
    const result = computePriceAndLiquidity(fromSymbol, toSymbol, aggregatedLiquidity);

    result.firstBlock = aggregatedLiquidity.firstBlock;
    result.lastBlock = aggregatedLiquidity.lastBlock;
    result.blockCount = aggregatedLiquidity.lastBlock - aggregatedLiquidity.firstBlock + 1;
    result.dataCount = aggregatedLiquidity.dataCount;
    result.dataRatio = result.dataCount / result.blockCount;
    result.queryDataRatio = result.dataCount / (toBlock - fromBlock + 1);

    return result;
}

/**
 * 
 * @param {string} dataDir 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} targetBlockNumber 
 * @returns 
 */
async function getUniswapPriceAndLiquidity(dataDir, fromSymbol, toSymbol, targetBlockNumber) {
    const liquidityAtBlock = await getUniV2DataForBlockNumber(dataDir, fromSymbol, toSymbol, targetBlockNumber);
    const result = computePriceAndLiquidity(fromSymbol, toSymbol, liquidityAtBlock);
    
    result.closestBlock = liquidityAtBlock.blockNumber;

    return result;
}

function computeUniswapV2Price(normalizedFrom, normalizedTo) {
    if(normalizedFrom == 0) {
        return 0;
    }
    return  normalizedTo / normalizedFrom;
}

function computePriceForReserve(fromSymbol, toSymbol, liquidity) { 
    const normalizedFrom = normalize(liquidity.fromReserve, tokens[fromSymbol].decimals);
    const normalizedTo = normalize(liquidity.toReserve, tokens[toSymbol].decimals);
    return computeUniswapV2Price(normalizedFrom, normalizedTo);

}

function computePriceAndLiquidity(fromSymbol, toSymbol, liquidity) {
    const normalizedFrom = normalize(liquidity.fromReserve, tokens[fromSymbol].decimals);
    const normalizedTo = normalize(liquidity.toReserve, tokens[toSymbol].decimals);
    const price = computeUniswapV2Price(normalizedTo / normalizedFrom);

    const result = {
        from: liquidity.from,
        to: liquidity.to,
        price: price,
        slippageMap: {},
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

async function getUniV2AggregatedDataForBlockNumbers(dataDir, fromSymbol, toSymbol, fromBlock, toBlock) {
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
    let sumReserve0 = BigNumber.from(0);
    let sumReserve1 = BigNumber.from(0);
    let firstBlock = undefined;
    let lastBlock = undefined;
    let cptData = 0;
    for await (const line of rl) {
        if(first) {
            first = false;
        } else {
            const splitted = line.split(',');
            const blockNumber = Number(splitted[0]);
            const reserve0 = splitted[1];
            const reserve1 = splitted[2];

            if(blockNumber >= fromBlock && blockNumber <= toBlock) {
                if(!firstBlock) {
                    firstBlock = blockNumber;
                }

                lastBlock = blockNumber;
                sumReserve0 = sumReserve0.add(BigNumber.from(reserve0));
                sumReserve1 = sumReserve1.add(BigNumber.from(reserve1));
                cptData++;
            }

            if(blockNumber >= toBlock) {
                break;
            }
        }
    }

    fileStream.close();

    if(cptData == 0) {
        throw new Error(`No values between blocks ${fromBlock} and ${toBlock}`);
    }
    const avgReserve0 = sumReserve0.div(cptData);
    const avgReserve1 = sumReserve1.div(cptData);

    const aggregatedLiquidity = {
        firstBlock: firstBlock,
        lastBlock: lastBlock,
        from: fromSymbol,
        to: toSymbol,
        dataCount: cptData,
    };

    if(fileInfo.reverse) {
        aggregatedLiquidity.fromReserve = avgReserve1;
        aggregatedLiquidity.toReserve = avgReserve0;
    } else {
        aggregatedLiquidity.fromReserve = avgReserve0;
        aggregatedLiquidity.toReserve = avgReserve1;
    }

    return aggregatedLiquidity;
}

function getUniV2DataContent(filePath, isReverse, fromSymbol, toSymbol, sinceBlock) {
    const dataContents = {};
    // load the file in RAM
    const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');
    let lastValue = {};
    for(let i = 1; i < fileContent.length - 1; i++) {
        const line = fileContent[i];
        const splt = line.split(',');
        const blockNum = Number(splt[0]);
        const fromReserve = isReverse ? splt[2] : splt[1];
        const toReserve = isReverse ? splt[1] : splt[2];        

        // if blockNum inferior to sinceBlock, ignore but save last value
        if(blockNum < sinceBlock) {
            lastValue = {
                blockNumber: blockNum,
                [`${fromSymbol}`]: fromReserve,
                [`${toSymbol}`]: toReserve
            };
        } else {
            // here it means we went through the sinceBlock, save the last value before 
            // reaching sinceBlock to have one previous data
            if(lastValue) {
                dataContents[lastValue.blockNumber] = {
                    blockNumber: lastValue.blockNumber,
                    [`${fromSymbol}`]: lastValue[fromSymbol],
                    [`${toSymbol}`]: lastValue[toSymbol]
                };

                // set lastValue to null, meaning we already saved it
                lastValue = null;
            } else {
                // save current value
                dataContents[blockNum] = {
                    blockNumber: blockNum,
                    [`${fromSymbol}`]: fromReserve,
                    [`${toSymbol}`]: toReserve,
                };
            }

        }

    }

    return dataContents;
}

function getUniV2DataforBlockRange(DATA_DIR, fromSymbol, toSymbol, blockRange) {
    const fileInfo = getUniV2DataFile(DATA_DIR, fromSymbol, toSymbol);
    if(!fileInfo) {
        console.log(`Could not find pool data for ${fromSymbol}/${toSymbol} on uniswapv2`);
        return null;
    }

    const dataContent = getUniV2DataContent(fileInfo.path, fileInfo.reverse, fromSymbol, toSymbol, blockRange[0]);

    const blocknumbers = Object.keys(dataContent).sort((a,b) => b - a);
    const results = {};
    for(const targetBlock of blockRange) {
        // for each blocknumber in blockRange, 
        // find the nearest blockNumber in data content that is <=
        const nearestBlockNumbers = blocknumbers.filter(_ => Number(_) <= targetBlock);
        if(nearestBlockNumbers.length == 0) {
            // if no data, set 0
            results[targetBlock] = {
                blockNumber: targetBlock,
                fromReserve: '0',
                toReserve: '0',
            };
            continue;
        }
        
        // data are sorted descending so nearest block is the last
        const nearestBlockNumber = Number(nearestBlockNumbers[0]);

        results[targetBlock] = {
            blockNumber: nearestBlockNumber,
            fromReserve: dataContent[nearestBlockNumber][fromSymbol],
            toReserve: dataContent[nearestBlockNumber][toSymbol],
        };
    }

    return results;
}

function getUniV2DataforBlockInterval(DATA_DIR, fromSymbol, toSymbol, fromBlock, toBlock) {
    const fileInfo = getUniV2DataFile(DATA_DIR, fromSymbol, toSymbol);
    if(!fileInfo) {
        throw new Error(`Could not find pool data for ${fromSymbol}/${toSymbol} on uniswapv2`);
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
    let selectedValue = null;
    for await (const line of rl) {
        if(first) {
            first = false;
        } else {
            const splitted = line.split(',');
            const blockNumber = Number(splitted[0]);
            const reserve0 = splitted[1];
            const reserve1 = splitted[2];

            // init selected value with first line
            if(!selectedValue) {
                selectedValue = {
                    blockNumber,
                    reserve0,
                    reserve1
                };
            }

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

function getUniv2PricesForBlockInterval(DATA_DIR, fromSymbol, toSymbol, startBlock, endBlock) {
    const dataForRange = getUniV2DataforBlockInterval(DATA_DIR, fromSymbol, toSymbol, startBlock, endBlock);
    const results = {};
    for(const [blockNumber, data] of Object.entries(dataForRange)) {
        if(blockNumber > endBlock) {
            continue;
        }

        const price = computePriceForReserve(fromSymbol, toSymbol, data);
        results[blockNumber] = price;
    }

    return results;
}


function computeUniv2ParkinsonVolatility(DATA_DIR, fromSymbol, toSymbol, startBlock, endBlock, daysToAvg) {
    const dataForRange = getUniv2PricesForBlockInterval(DATA_DIR, fromSymbol, toSymbol, startBlock, endBlock);
    // console.log(dataForRange);
    const blockNumbers = Object.keys(dataForRange);
    let lastPriceHigh = dataForRange[blockNumbers[0]];
    let lastPriceLow = dataForRange[blockNumbers[0]];
    const rangeValues = [];
    const avgBlockPerDay = Math.round((endBlock - startBlock) / daysToAvg);
    console.log(`avgBlockPerDay: ${avgBlockPerDay}`);
    for (let T = 0; T < daysToAvg; T++) {
        const blockStart = T * avgBlockPerDay + startBlock;
        const blockEnd = Math.min(blockStart + avgBlockPerDay, endBlock);
        const blocksInRange = blockNumbers.filter(_ => _ >= blockStart && _ < blockEnd);
        // console.log(`# prices in range [${blockStart} - ${blockEnd}]: ${blocksInRange.length}`);
        let highPrice = -1;
        let lowPrice = Number.MAX_SAFE_INTEGER;
        if (blocksInRange.length == 0) {
            highPrice = lastPriceHigh;
            lowPrice = lastPriceLow;
        }
        else {
            for (const block of blocksInRange) {
                const price = dataForRange[block];
                if (highPrice < price) {
                    highPrice = price;
                    lastPriceHigh = price;
                }
                if (lowPrice > price) {
                    lowPrice = price;
                    lastPriceLow = price;
                }
            }
        }

        if (highPrice < 0) {
            console.log(`Could not find prices for range [${blockStart} - ${blockEnd}]. Will use last value`);
            if (rangeValues.length == 0) {
                throw new Error(`Could not find even the first value for ${fromSymbol}/${toSymbol}`);
            } else {
                const lastValue = rangeValues.at(-1);
                highPrice = lastValue.high;
                lowPrice = lastValue.low;
            }
        }

        console.log(`For range [${blockStart} - ${blockEnd}]: low: ${lowPrice} <> high: ${highPrice}. Data #: ${blocksInRange.length}`);
        rangeValues.push({ low: lowPrice, high: highPrice });

    }

    // console.log(rangeValues);
    let sumOfLn = 0;

    for (let T = 0; T < daysToAvg; T++) {
        const valuesForRange = rangeValues[T];
        const htltRatio = valuesForRange.high / valuesForRange.low;
        const htltRatioSquare = htltRatio * htltRatio;
        const lnHtltRatioSquare = Math.log(htltRatioSquare);
        sumOfLn += lnHtltRatioSquare;
    }

    const prefix = 1 / ((4 * daysToAvg) * Math.log(2));

    const insideSqrt = prefix * sumOfLn;

    const volatilityParkinson = Math.sqrt(insideSqrt);
    return volatilityParkinson;
}

console.log('parkinson liquidity WETH/USDC:', computeUniv2ParkinsonVolatility('./data', 'WETH', 'USDC', 17469815, 17683325, 30));


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

module.exports = { getUniswapPriceAndLiquidity, getUniswapAveragePriceAndLiquidity, computeUniswapV2Price,
    getUniV2DataforBlockRange, computeLiquidityUniV2Pool, getAvailableUniswapV2, getUniV2DataFile,
    getUniV2DataforBlockInterval, computePriceForReserve, computeUniv2ParkinsonVolatility};
