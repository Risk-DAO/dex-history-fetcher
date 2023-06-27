
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

function getUniV2DataforBlockRange(DATA_DIR, fromSymbol, toSymbol, blockRange) {
    const fileInfo = getUniV2DataFile(DATA_DIR, fromSymbol, toSymbol);
    if(!fileInfo) {
        console.log(`Could not find pool data for ${fromSymbol}/${toSymbol} on uniswapv2`);
        return null;
    }
    // load the file in RAM
    const fileContent = fs.readFileSync(fileInfo.path, 'utf-8').split('\n');

    // loop through until finding infos for each block in the blockRange
    let targetBlockNumberIndex = 0;
    let targetBlockNumber = blockRange[targetBlockNumberIndex];
    let lastLine = fileContent[1];
    const results = {};

    // start at 2 because first line is headers and second is in lastLine
    let fileContentIndex = 2;
    while(targetBlockNumberIndex < blockRange.length) {
        const splitted = fileContent[fileContentIndex].split(',');
        const blockNumber = Number(splitted[0]);

        if(blockNumber < targetBlockNumber) {
            // do nothing except save that line in lastLine and incr fileContentIndex
            lastLine = fileContent[fileContentIndex];
            if(fileContentIndex < fileContent.length - 2) {
                fileContentIndex++;
            } else {
                console.log(`${fnName()}: End of file reached with ${Object.keys(results).length} results found`);
                break;
            }
        } else {
            const lastLineSplitted = lastLine.split(',');
            const lastLineBlocknumber = Number(lastLineSplitted[0]);

            // here lastLine.blockNumber < currentTargetBlockNumber <= blockNumber
            // need to find the closest block between blockNumber and lastLine.blockNumber
            // and record the value of the closest
            const distanceFromLast = Math.abs(targetBlockNumber - lastLineBlocknumber);
            const distanceFromCurrent =  Math.abs(targetBlockNumber - blockNumber);
            
            // take current because distance is less
            if(distanceFromLast > distanceFromCurrent) {
                results[targetBlockNumber] = {
                    blockNumber: blockNumber,
                    fromReserve: fileInfo.reverse ? splitted[2] : splitted[1],
                    toReserve: fileInfo.reverse ? splitted[1] : splitted[2]
                };
            } else {
                results[targetBlockNumber] = {
                    blockNumber: lastLineBlocknumber,
                    fromReserve: fileInfo.reverse ? lastLineSplitted[2] : lastLineSplitted[1],
                    toReserve: fileInfo.reverse ? lastLineSplitted[1] : lastLineSplitted[2]
                };
            }

            targetBlockNumberIndex++;
            targetBlockNumber = blockRange[targetBlockNumberIndex];
            // here, we don't increment fileContentIndex because we might have multiple lines valid for the sale target block
        }
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
    const initPrice = toReserve / fromReserve;
    const targetPrice = initPrice - (initPrice * targetSlippage);
    const amountOfFromToExchange = (toReserve / targetPrice) - fromReserve;
    return amountOfFromToExchange;
}


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
    getUniV2DataforBlockInterval, computePriceForReserve};
