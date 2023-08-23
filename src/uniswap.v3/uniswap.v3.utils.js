
const BigNumber = require('bignumber.js');
const { fnName } = require('../utils/utils');
const fs = require('fs');
const path = require('path');

const CONSTANT_1e18 = new BigNumber(10).pow(18);
const CONSTANT_TARGET_SLIPPAGE = 20;

/**
 * Calculate the price of token0 vs token1.
 * @param {number} currentTick 
 * @param {number} token0Decimals 
 * @param {number} token1Decimals 
 * @returns {number} the price of token0. which mean how much token1 can 1 token0 buy. 1/this result gives the price of token1 vs token0
 */
function getPriceNormalized(currentTick, token0Decimals, token1Decimals) {
    const token0DecimalFactor = 10 ** token0Decimals;
    const token1DecimalFactor = 10 ** token1Decimals;
    const price = getTickPrice(currentTick);
    const priceToken0VsToken1 = price * token0DecimalFactor / token1DecimalFactor;
    return priceToken0VsToken1;
}

function getTickPrice(tick) {
    return 1.0001 ** tick;
}

/**
 * Get the next lower tick as the current tick returned can sometimes not be in the valid range
 * @param {number} currentTick 
 * @param {number} tickSpacing 
 * @returns {number} Valid tick
 */
function getNextLowerTick(currentTick, tickSpacing) {
    return (Math.floor(currentTick / tickSpacing)) * tickSpacing;
}

function getSlippages(currentTick, tickSpacing, sqrtPriceX96, liquidity, token0Decimals, token1Decimals) {
    const token0Slippage = get_dx_slippage(currentTick, tickSpacing, sqrtPriceX96, liquidity, token0Decimals);
    const token1Slippage =  get_dy_slippage(currentTick, tickSpacing, sqrtPriceX96, liquidity, token1Decimals);

    return {token0Slippage, token1Slippage};
}


/**
 * For a pool with pair {token0}-{token1}, returns the slippage map for amounts of token0 tradable for x% slippage
 * @param {number} currentTick the current price tick
 * @param {number} tickSpacing tick spacing
 * @param {string} sqrtPriceX96 string representation of sqrtPriceX96
 * @param {{[tick: number]: number}} liquidity liquidities, expressed as ticks
 * @param {number} tokenDecimals decimals number of token0
 * @returns {BigNumber} amount receivable
 */
function get_dx_slippage(currentTick, tickSpacing, sqrtPriceX96, liquidity, tokenDecimals) {
    const base = new BigNumber(1.0001);
    const decimalFactor = new BigNumber(10).pow(tokenDecimals);
    let dx = new BigNumber(0);
    BigNumber.config({ POW_PRECISION: 10 });
    const _96bits = new BigNumber(2).pow(new BigNumber(96));
    let currSqrtPrice = new BigNumber(sqrtPriceX96).div(_96bits); 
    let currTick = getNextLowerTick(Number(currentTick), tickSpacing);

    // 100 ticks = 1% slippage according to whitepaper
    //  'This has the desirable property of each tick being a .01% (1 basis point) price movement away from each of its neighboring ticks.'
    let targetTick = getNextLowerTick(currTick + CONSTANT_TARGET_SLIPPAGE * 100, tickSpacing);
    
    // 'relevantTicks' will store ticks and the corresponding slippage in bps
    // [tick: number]: number
    // {
    //     "205970": 100,
    //     "205920": 150,
    //     "205870": 200,
    // }
    const relevantTicks = {};
    const slippageIncr = tickSpacing > 50 ? tickSpacing : 50;
    let slippageBps = slippageIncr;
    while(slippageBps <= CONSTANT_TARGET_SLIPPAGE * 100) {
        let currentSlippageTick = getNextLowerTick(currTick + slippageBps, tickSpacing);
        if(!relevantTicks[currentSlippageTick]) {
            // only add if the value does not exists yet
            relevantTicks[currentSlippageTick] = slippageBps;
        }
        // console.log(`${fnName()}: ${currentSlippageTick} slippage = ${relevantTicks[currentSlippageTick]}`);
        slippageBps += slippageIncr;
    }

    // 'slippageData' will store for each amount of slippage, the amount of y tradable
    const slippageData = {};

    // console.log(liquidity);
    // when selling y, the price goes down
    while(currTick <= targetTick) {
        const nextTick = currTick + Number(tickSpacing);
        //console.log({base},{nextTick})
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        let liquidityAtTick = liquidity[currTick];
        if(!liquidityAtTick) {
            liquidityAtTick = 0;
        }
        const L = new BigNumber(liquidityAtTick).times(CONSTANT_1e18);
        // console.log(L.toString());
        dx = dx.plus(L.div(currSqrtPrice).minus(L.div(nextSqrtPrice)));
        // console.log(dx.toString());
        if(Object.keys(relevantTicks).map(_ => Number(_)).includes(currTick)) {
            slippageData[relevantTicks[currTick]] = dx.div(decimalFactor).toNumber() || 0;
        }

        // move to next tick
        currSqrtPrice = nextSqrtPrice;
        currTick = nextTick;
    }

    return slippageData;
}

/**
 * For a pool with pair {token0}-{token1}, returns the slippage map for amounts of token1 tradable for x% slippage
 * @param {number} currentTick the current price tick
 * @param {number} tickSpacing tick spacing
 * @param {string} sqrtPriceX96 string representation of sqrtPriceX96
 * @param {{[tick: number]: number}} liquidity liquidities, expressed as ticks
 * @param {number} tokenDecimals decimals number of token1
 * @returns {BigNumber} amount receivable
 */
function get_dy_slippage(currentTick, tickSpacing, sqrtPriceX96, liquidity, tokenDecimals) {
    const base = new BigNumber(1.0001);
    const decimalFactor = new BigNumber(10).pow(tokenDecimals);
    let dy = new BigNumber(0);
    BigNumber.config({ POW_PRECISION: 10 });
    const _96bits = new BigNumber(2).pow(new BigNumber(96));
    let currSqrtPrice = new BigNumber(sqrtPriceX96).div(_96bits); 
    let currTick = getNextLowerTick(Number(currentTick), tickSpacing);
    // 100 ticks = 1% slippage according to whitepaper
    //  'This has the desirable property of each tick being a .01% (1 basis point) price movement away from each of its neighboring ticks.'
    let targetTick = getNextLowerTick(currTick - CONSTANT_TARGET_SLIPPAGE * 100, tickSpacing);
    
    // 'relevantTicks' will store ticks and the corresponding slippage in bps
    // [tick: number]: number
    // {
    //     "205970": 100,
    //     "205920": 150,
    //     "205870": 200,
    // }

    
    const relevantTicks = {};
    
    const slippageIncr = tickSpacing > 50 ? tickSpacing : 50;
    let slippageBps = slippageIncr;
    while(slippageBps <= CONSTANT_TARGET_SLIPPAGE * 100) {
        let currentSlippageTick = getNextLowerTick(currTick - slippageBps, tickSpacing);
        if(!relevantTicks[currentSlippageTick]) {
            // only add if the value does not exists yet
            relevantTicks[currentSlippageTick] = slippageBps;
        }
        // console.log(`${fnName()}: ${currentSlippageTick} slippage = ${relevantTicks[currentSlippageTick]}`);
        slippageBps += slippageIncr;
    }

    // 'slippageData' will store for each amount of slippage, the amount of y tradable
    const slippageData = {};

    // when selling x, the price goes up
    while(currTick >= targetTick) {
        const nextTick = currTick - Number(tickSpacing);
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        let liquidityAtTick = liquidity[currTick];
        if(!liquidityAtTick) {
            liquidityAtTick = 0;
        }
        const L = new BigNumber(liquidityAtTick).times(CONSTANT_1e18);
        const dSqrtP = currSqrtPrice.minus(nextSqrtPrice);
        dy = dy.plus(L.times(dSqrtP));

        if(Object.keys(relevantTicks).map(_ => Number(_)).includes(currTick)) {
            slippageData[relevantTicks[currTick]] = dy.div(decimalFactor).toNumber() || 0;
        }

        // move to next tick
        currSqrtPrice = nextSqrtPrice;
        currTick = nextTick;
    }

    return slippageData;
}

function getAvailableUniswapV3(dataDir) {
    const available = {};
    const files = fs.readdirSync(`${dataDir}/uniswapv3/`).filter(_ => _.endsWith('.csv'));
    for(const file of files) {
        const splitted = file.split('-');

        const tokenA = splitted[0];
        const tokenB = splitted[1];
        if(!available[tokenA]) {
            available[tokenA] = [];
        }
        if(!available[tokenB]) {
            available[tokenB] = [];
        }

        if(!available[tokenA].includes(tokenB)) {
            available[tokenA].push(tokenB);
        }

        if(!available[tokenB].includes(tokenA)) {
            available[tokenB].push(tokenA);
        }
    }

    return available;
}

function getUniV3DataFiles(dataDir, fromSymbol, toSymbol) {
    
    const allUniv3Files = fs.readdirSync(path.join(dataDir, 'uniswapv3')).filter(_ => _.endsWith('.csv'));
    
    let searchKey = `${fromSymbol}-${toSymbol}`;
    let reverse = false;
    let selectedFiles = allUniv3Files.filter(_ => _.startsWith(searchKey));
    if(selectedFiles.length == 0) {
        let searchKey = `${toSymbol}-${fromSymbol}`;
        reverse = true;
        selectedFiles = allUniv3Files.filter(_ => _.startsWith(searchKey));

    }

    return {selectedFiles, reverse};
}

/**
 * 
 * @param {string} dataDir 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number[]} blockRange 
 * @returns {{[targetBlock: number]: {blockNumber: number, price: number, slippageMap: {[slippagePct: number]: number}}}}
 */
function getUniV3DataforBlockInterval(dataDir, fromSymbol, toSymbol, sinceBlock, toBlock) {
    console.log(`${fnName()}: Searching for ${fromSymbol}/${toSymbol} since ${sinceBlock} to ${toBlock}`);
    
    const results = {};

    const {selectedFiles, reverse} = getUniV3DataFiles(dataDir, fromSymbol, toSymbol);

    if(selectedFiles.length == 0) {
        console.log(`Could not find univ3 files for ${fromSymbol}/${toSymbol}`);
        return results;
    }

    const dataContents = getUniV3DataContents(selectedFiles, dataDir, sinceBlock);

    // select base file = the file with the most lines
    let baseFile = selectedFiles[0];
    const keys = {};
    keys[baseFile] = Object.keys(dataContents[baseFile]);
    for(let i = 1; i < selectedFiles.length; i++) {
        const selectedFile = selectedFiles[i];
        keys[selectedFile] = Object.keys(dataContents[selectedFile]);
        if(Object.keys(dataContents[baseFile]).length < keys[selectedFile].length) {
            baseFile = selectedFile;
        }
    }

    for(const targetBlock of keys[baseFile]) {
        if(targetBlock > toBlock) {
            break;
        }
        // find the closest value from the basefile and init the result with the data
        const nearestBlockNumbers = keys[baseFile].filter(_ => Number(_) <= targetBlock);
        if(nearestBlockNumbers.length == 0) {
            // if no data, ignore block
            continue;
        }

        const nearestBlockNumber = Number(nearestBlockNumbers.at(-1));
        // console.log(`[${targetBlock}] ${baseFile} nearest block value is ${nearestBlockNumber}. Distance: ${targetBlock-nearestBlockNumber}`);
        results[targetBlock] = {
            blockNumber: nearestBlockNumber,
            price: reverse ? dataContents[baseFile][nearestBlockNumber].p1vs0 : dataContents[baseFile][nearestBlockNumber].p0vs1,
        };

        // clone the data because we need to modify it without modifying the source
        const baseSlippageMap = {};
        const baseFileSlippageMap = dataContents[baseFile][nearestBlockNumber][`${fromSymbol}-slippagemap`];
        let slippageBps = 50;
        while (slippageBps <= CONSTANT_TARGET_SLIPPAGE * 100) {
            let slippageValue = baseFileSlippageMap[slippageBps];
            
            if(!slippageValue) {
                // find the closest value that is < slippageBps
                const sortedAvailableSlippageBps = Object.keys(baseFileSlippageMap).filter(_ => _ < slippageBps).sort((a,b) => b - a);
                if(sortedAvailableSlippageBps.length == 0) {
                    slippageValue = 0;
                } else {
                    slippageValue = baseFileSlippageMap[sortedAvailableSlippageBps[0]];
                } 
            }
            if(slippageValue < 0) {
                slippageValue = 0;
            }
            baseSlippageMap[slippageBps] = slippageValue;
            slippageBps += 50;
        }

        results[targetBlock].slippageMap = baseSlippageMap;

        // do the same for every other data contents, but only summing the slippagemap
        for(const filename of selectedFiles) {
            if(filename == baseFile) {
                continue; // base file already done
            }

            const nearestBlockNumbers = keys[filename].filter(_ => Number(_) <= targetBlock);
            if(nearestBlockNumbers.length == 0) {
                continue; // no available data in source?
            }

            const nearestBlockNumber = nearestBlockNumbers.at(-1);
            // console.log(`[${targetBlock}] ${filename} nearest block value is ${nearestBlockNumber}. Distance: ${targetBlock-nearestBlockNumber}`);
            const slippageMap = dataContents[filename][nearestBlockNumber][`${fromSymbol}-slippagemap`];

            let slippageBps = 50;
            while (slippageBps <= CONSTANT_TARGET_SLIPPAGE * 100) {
                let volumeToAdd = slippageMap[slippageBps];
                if(!volumeToAdd) {
                    // find the closest value that is < slippageBps
                    const sortedAvailableSlippageBps = Object.keys(slippageMap).filter(_ => _ < slippageBps).sort((a,b) => b - a);
                    if(sortedAvailableSlippageBps.length == 0) {
                        volumeToAdd = 0;
                    } else {
                        volumeToAdd = slippageMap[sortedAvailableSlippageBps[0]];
                    }
                } 

                if(volumeToAdd < 0) {
                    volumeToAdd = 0;
                }
                results[targetBlock].slippageMap[slippageBps] += volumeToAdd;
                slippageBps += 50;
            }
        }
    }

    return results;
}

function getUniV3DataContents(selectedFiles, dataDir, minBlock=0) {
    const dataContents = {};
    for (let i = 0; i < selectedFiles.length; i++) {
        const selectedFile = selectedFiles[i];
        dataContents[selectedFiles[i]] = {};
        const fileContent = fs.readFileSync(path.join(dataDir, 'uniswapv3', selectedFile), 'utf-8').split('\n')
            // remove first line, which is headers
            .splice(1);

        // remove last line, which is empty
        fileContent.pop();

        let lastLine = fileContent[0];
        for (let j = 1; j < fileContent.length; j++) {
            const blockNumber = Number(fileContent[j].split(',')[0]);
            if(blockNumber < minBlock) {
                lastLine = fileContent[j];
                continue;
            }

            // when breaching the minblock, save the last line
            if(blockNumber > minBlock && lastLine) {
                const lastLineBlockNumber = Number(lastLine.split(',')[0]);
                const lastLineJsonStr = lastLine.replace(`${lastLineBlockNumber},`, '');
                const lastLineParsed = JSON.parse(lastLineJsonStr);
                dataContents[selectedFile][lastLineBlockNumber] = lastLineParsed;
                lastLine = null;
            }

            const jsonStr = fileContent[j].replace(`${blockNumber},`, '');
            const parsed = JSON.parse(jsonStr);
            dataContents[selectedFile][blockNumber] = parsed;
        }

        // if lastline is still instancied, it means we never breached the minBlock and that the
        // datacontent for the file is empty
        // in that case, just save the last line as the only point
        if(lastLine && Object.keys(dataContents[selectedFile]) == 0) {
            const lastLineBlockNumber = Number(lastLine.split(',')[0]);
            const lastLineJsonStr = lastLine.replace(`${lastLineBlockNumber},`, '');
            const lastLineParsed = JSON.parse(lastLineJsonStr);
            dataContents[selectedFile][lastLineBlockNumber] = lastLineParsed;
        }
    }
    
    return dataContents;
}

module.exports = { getPriceNormalized, getSlippages, getAvailableUniswapV3, getUniV3DataforBlockInterval };
