
const BigNumber = require('bignumber.js');
const { ethers } = require('ethers');
const { getConfTokenBySymbol } = require('../utils/token.utils');
const { roundTo, logFnDuration, fnName } = require('../utils/utils');
const univ3Config = require('./uniswap.v3.config');
const fs = require('fs');
const path = require('path');

const CONSTANT_1e18 = new BigNumber(10).pow(18);
const CONSTANT_TARGET_SLIPPAGE = 20;

async function generateConfigFromBaseAndQuote(web3Provider, bases, quotes) {
    const univ3Factory = new ethers.Contract(univ3Config.uniswapFactoryV3Address, univ3Config.uniswapFactoryV3Abi, web3Provider);
    const fees = [10000,3000,500,100];

    const conf = [];
    for(const base of bases) {
        for(const quote of quotes) {
            const baseToken = getConfTokenBySymbol(base);
            const quoteToken =  getConfTokenBySymbol(quote);
            for(const fee of fees) {

                const poolAddress = await univ3Factory.getPool(baseToken.address, quoteToken.address, fee);
                
                if(poolAddress == ethers.constants.AddressZero) {
                    console.log(`No pool found for ${base}/${quote} and fee: ${fee}`);
                    continue;
                } else {
                    console.log(`Found a pool for ${base}/${quote} and fee: ${fee}`);

                }

                const univ3PairContract = new ethers.Contract(poolAddress, univ3Config.uniswapV3PairAbi, web3Provider);
                const contractToken0 = await univ3PairContract.token0();

                let reverse = false;
                if(contractToken0.toLowerCase() != baseToken.address.toLowerCase()) {
                    reverse = true;
                }

                const token0 = reverse ? quoteToken.symbol : baseToken.symbol;
                const token1 = reverse ? baseToken.symbol : quoteToken.symbol;

                const alreadyAdded = conf.some(_ => _.token0 == token0 && _.token1 == token1 && _.fees == fee);
                if(!alreadyAdded) {
                    conf.push({
                        token0: token0,
                        token1: token1,
                        fees: fee
                    });
                }
            }
        }
    }

    return conf;
}

function getVolumeForSlippage(targetSlippagePercent, zeroForOne, currentTick, tickSpacing, sqrtPriceX96, liquidity) {
    const dtStart = Date.now();
    const priceFunction = zeroForOne ? get_dy : get_dx;

    const baseAmount = new BigNumber(1);
    const basePrice = priceFunction(currentTick, tickSpacing, sqrtPriceX96, liquidity, baseAmount);
    const targetPrice = basePrice.minus(basePrice.times(targetSlippagePercent).div(100));
    // console.log(`base price: ${basePrice}, for ${targetSlippagePercent}% slippage, target price: ${targetPrice}`);

    let tryQty = baseAmount.times(2);
    let high = undefined;
    let low = baseAmount;

    const exitBoundsDiff = 1/100; // exit binary search when low and high bound have less than this amount difference

    let lastValidTryQty = undefined;
    let lastEffectiveSlippage = undefined;
    let lastCurrentPrice = undefined;
    try {
        // eslint-disable-next-line no-constant-condition
        while(true) {
            const currentVolume = priceFunction(currentTick, tickSpacing, sqrtPriceX96, liquidity, tryQty);
            const currentPrice = currentVolume.div(tryQty);

            const effectiveSlippage = roundTo(Number(basePrice.div(currentPrice).minus(1).times(100)), 2);
            console.log(`TRY ${tryQty} [${low} - ${high}]: current price: ${currentPrice}, effectiveSlippage: ${effectiveSlippage}%`);
            if(high && low) {
                const variation = high.div(low).minus(1);
                if(variation.lt(exitBoundsDiff)) {
                    if(effectiveSlippage <= targetSlippagePercent) {
                        console.log(`current price: ${currentPrice}, effectiveSlippage: ${effectiveSlippage}%, target: ${targetSlippagePercent}%`);
                        return tryQty;
                    } else {
                        console.log(`current last valid value. Price: ${lastCurrentPrice}, effectiveSlippage: ${lastEffectiveSlippage}%, target: ${targetSlippagePercent}%`);
                        return lastValidTryQty;
                    }
                }
            }

            if(effectiveSlippage < targetSlippagePercent) {
                lastValidTryQty = tryQty;
                lastEffectiveSlippage = effectiveSlippage;
                lastCurrentPrice = currentPrice;
                // if effective slippage too low, need to increase the next tryQty
                // also we can set low = tryQty
                low = tryQty;

                if(high) {
                    tryQty = tryQty.plus(high.minus(low).div(2));
                } else {
                    tryQty = tryQty.times(2);
                }
            } else {
                // if effective slippage too high, need to decrease the next tryQty
                // also we can set high = tryQty
                high = tryQty;
                
                if(low) {
                    tryQty = tryQty.minus(high.minus(low).div(2));
                } else {
                    tryQty = tryQty.div(2);
                }
            }
        }
    }
    finally {
        logFnDuration(dtStart);
    }
}

function getVolumeForSlippageRange(minSlippage, maxSlippage, zeroForOne, currentTick, tickSpacing, sqrtPriceX96, liquidity, baseTokenDecimals) {
    const dtStart = Date.now();
    const priceFunction = zeroForOne ? get_dy : get_dx;

    const baseAmount = new BigNumber(1);
    const basePrice = priceFunction(currentTick, tickSpacing, sqrtPriceX96, liquidity, baseAmount);

    let tryQty = baseAmount.times(2);
    let high = undefined;
    let low = baseAmount;

    const acceptableRange = 1/100; // the effective slippage acceptable range. if 1% and target slippage is 10% then we accept a value between 9.9% 10.1% 
    let targetSlippage = minSlippage;

    const decimalFactor = new BigNumber(10).pow(baseTokenDecimals);
    const slippageObj = {};
    try {
        // eslint-disable-next-line no-constant-condition
        while(targetSlippage <= maxSlippage) {
            const currentVolume = priceFunction(currentTick, tickSpacing, sqrtPriceX96, liquidity, tryQty);
            const currentPrice = currentVolume.div(tryQty);

            const effectiveSlippage = roundTo(Number(basePrice.div(currentPrice).minus(1).times(100)), 2);
            // console.log(`TRY ${tryQty} [${low} - ${high}]: current price: ${currentPrice}, effectiveSlippage: ${effectiveSlippage}%`);

            if(effectiveSlippage < targetSlippage * (1+acceptableRange) 
                && effectiveSlippage > targetSlippage * (1-acceptableRange)) {

                const qtyNorm = tryQty.div(decimalFactor).toNumber();
                console.log(`Volume for slippage: ${qtyNorm}, effectiveSlippage: ${effectiveSlippage}%, target: ${targetSlippage}%`);
                slippageObj[targetSlippage] = qtyNorm;
                targetSlippage++;
                high = undefined;
                tryQty = tryQty.times(2);
                continue;
            }

            if(effectiveSlippage < targetSlippage) {
                // if effective slippage too low, need to increase the next tryQty
                // also we can set low = tryQty
                low = tryQty;

                if(high) {
                    tryQty = tryQty.plus(high.minus(low).div(2));
                } else {
                    tryQty = tryQty.times(2);
                }
            } else {
                // if effective slippage too high, need to decrease the next tryQty
                // also we can set high = tryQty
                high = tryQty;
                
                if(low) {
                    tryQty = tryQty.minus(high.minus(low).div(2));
                } else {
                    tryQty = tryQty.div(2);
                }
            }
        }

        return slippageObj;
    }
    finally {
        logFnDuration(dtStart);
    }
}

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
// tick 206077
// function test() {
//     const currentTick = 202293;
//     const p0 = 1/getPriceNormalized(currentTick, 6, 18);
//     const p1 = 1/getPriceNormalized(currentTick + 100, 6, 18);
//     console.log('p0',p0);
//     console.log('p1', p1);
//     const p0Slippage1 = p0 - (p0*1/100);
//     console.log('p0Slippage1', p0Slippage1);

//     // 1 tick++ is +0.01% price for token0vstoken1
//     // 1 tick++ is -0.01% price for token1vstoken0

//     // +100 ticks mean -1% price token1vstoken0
// }
// test();
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


/**
 * For a pool with pair {token0}-{token1}, returns amount of token1 you will receive by trading in 'dx' amount of token0
 * Ex: for the USDC-WETH pool, dx is the amount of USDC to trade in and the function returns the amount of WETH you will receive
 * With uniswap vocabulary, this is the trade "ZeroForOne" -> trade token0 for token1
 * @param {number} currentTick the current price tick
 * @param {number} tickSpacing tick spacing
 * @param {string} sqrtPriceX96 string representation of sqrtPriceX96
 * @param {{[tick: number]: number}} liquidity liquidities, expressed as ticks
 * @param {BigNumber} dx amount to trade
 * @returns {BigNumber} amount receivable
 */
function get_dy(currentTick, tickSpacing, sqrtPriceX96, liquidity, dx) {
    const base = new BigNumber(1.0001);

    let remainingQty = new BigNumber(dx);
    let dy = new BigNumber(0);
    BigNumber.config({ POW_PRECISION: 10 });
    const _96bits = new BigNumber(2).pow(new BigNumber(96));
    let currSqrtPrice = new BigNumber(sqrtPriceX96).div(_96bits); 
    let currTick = getNextLowerTick(Number(currentTick), tickSpacing);

    // when selling x, the price goes up
    while(remainingQty.gt(0)) {
        const nextTick = currTick - Number(tickSpacing);
        //console.log({base},{nextTick})
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        let liquidityAtTick = liquidity[currTick];
        if(!liquidityAtTick) {
            liquidityAtTick = 0;
        }
        const L = new BigNumber(liquidityAtTick).times(CONSTANT_1e18);
        // console.log({currTick});

        // dx = L/d(sqrt(p))
        const dP = currSqrtPrice.minus(nextSqrtPrice);
        const maxDx = (L.div(nextSqrtPrice)).minus(L.div(currSqrtPrice));
        // console.log(L.toString(), maxDx.toString(), currSqrtPrice.toString());

        //console.log(currSqrtPrice.toString(), nextSqrtPrice.toString())

        let dSqrtP;
        if(remainingQty.lt(maxDx)) {
            // qty = L/nextP - L/p
            // L/nextP = L/p + qty
            // nextP = L/(L/p + qty)
            const nextP = L.div(L.div(currSqrtPrice).plus(remainingQty));
            dSqrtP = currSqrtPrice.minus(nextP);
            remainingQty = new BigNumber(0);
        }
        else {
            dSqrtP = currSqrtPrice.minus(nextSqrtPrice);
            remainingQty = remainingQty.minus(maxDx);
            // console.log('maxDx', maxDx.toString());
        }

        // dy = L * d(sqrt(p))
        dy = dy.plus(L.times(dSqrtP));


        // console.log('dy', dy.toString(), remainingQty.toString(), currTick);


        // move to next tick
        currSqrtPrice = nextSqrtPrice;
        currTick = nextTick;
    }

    return dy;
}

/**
 * For a pool with pair {token0}-{token1}, returns amount of token0 you will receive by trading in 'dy' amount of token1
 * Ex: for the USDC-WETH pool, dy is the amount of ETH to trade in and the function returns the amount of USDC you will receive
 * With uniswap vocabulary, this is the trade "OneForZero" -> trade token1 for token0
 * @param {number} currentTick the current price tick
 * @param {number} tickSpacing tick spacing
 * @param {string} sqrtPriceX96 string representation of sqrtPriceX96
 * @param {{[tick: number]: number}} liquidity liquidities, expressed as ticks
 * @param {BigNumber} dy amount to trade
 * @returns {BigNumber} amount receivable
 */
function get_dx(currentTick, tickSpacing, sqrtPriceX96, liquidity, dy) {
    const base = new BigNumber(1.0001);

    let remainingQty = new BigNumber(dy);
    let dx = new BigNumber(0);
    BigNumber.config({ POW_PRECISION: 10 });
    const _96bits = new BigNumber(2).pow(new BigNumber(96));
    let currSqrtPrice = new BigNumber(sqrtPriceX96).div(_96bits); 
    let currTick = getNextLowerTick(Number(currentTick), tickSpacing);

    // when selling y, the price goes down
    while(remainingQty.gt(0)) {
        const nextTick = currTick + Number(tickSpacing);
        //console.log({base},{nextTick})
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        let liquidityAtTick = liquidity[currTick];
        if(!liquidityAtTick) {
            liquidityAtTick = 0;
        }
        const L = new BigNumber(liquidityAtTick).times(CONSTANT_1e18);
        // console.log({currTick});

        // dx = L/d(sqrt(p))
        const maxDy = L.times(nextSqrtPrice.minus(currSqrtPrice));
        // console.log(L.toString(), maxDy.toString(), currSqrtPrice.toString());

        //console.log(currSqrtPrice.toString(), nextSqrtPrice.toString())

        let nextP;
        if(remainingQty.lt(maxDy)) {
            // qty = L(nextP - P)
            // nextP = p + qty/L
            nextP = currSqrtPrice.plus(remainingQty.div(L));
            remainingQty = new BigNumber(0);
        }
        else {
            nextP = nextSqrtPrice;
            remainingQty = remainingQty.minus(maxDy);
            // console.log('maxDy', maxDy.toString());
        }

        // dx = L/pcurrent - L/pnext
        dx = dx.plus(L.div(currSqrtPrice).minus(L.div(nextP)));
        // console.log(nextP.toString(), currSqrtPrice.toString());


        // console.log('dx', dx.toString(), remainingQty.toString(), currTick);


        // move to next tick
        currSqrtPrice = nextSqrtPrice;
        currTick = nextTick;
    }

    return dx;
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
 * @returns {Promise<{[targetBlock: number]: {blockNumber: number, price: number, slippageMap: {[slippagePct: number]: number}}}>}
 */
function getUniV3DataforBlockRange(dataDir, fromSymbol, toSymbol, blockRange) {
    console.log(`${fnName()}: Searching for ${fromSymbol}/${toSymbol}`);
    
    const results = {};

    const {selectedFiles, reverse} = getUniV3DataFiles(dataDir, fromSymbol, toSymbol);

    if(selectedFiles.length == 0) {
        console.log(`Could not find univ3 files for ${fromSymbol}/${toSymbol}`);
        return results;
    }

    const dataContents = getUniV3DataContents(selectedFiles, dataDir, blockRange[0]);

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

    for(const targetBlock of blockRange) {

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


/**
 * 
 * @param {string} dataDir 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number[]} blockRange 
 * @returns {Promise<{[targetBlock: number]: {blockNumber: number, price: number, slippageMap: {[slippagePct: number]: number}}}>}
 */
function getUniV3DataforBlockInterval(dataDir, fromSymbol, toSymbol, sinceBlock, toBlock) {
    console.log(`${fnName()}: Searching for ${fromSymbol}/${toSymbol}`);
    
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

/**
 * Returns all the data we have for uniswap v3 for a pair fromSymbol/toSymbol
 * the results are returned for each blocks where we have data for each pools
 * the results are the sum of each pools at every blocks where we have data for the most used pool
 * @param {string} dataDir 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} sinceBlock 
 * @returns {Promise<{[targetBlock: number]: {blockNumber: number, averagePrice: number, slippageMapAvg: {[slippagePct: number]: number}}}>}
 */
// function getUniV3DataSinceBlock(dataDir, fromSymbol, toSymbol, sinceBlock) {
//     // console.log(`${fnName()}: Searching for ${fromSymbol}/${toSymbol}`);
    
//     const results = {};

//     const {selectedFiles, reverse} = getUniV3DataFiles(dataDir, fromSymbol, toSymbol);

//     if(selectedFiles.length == 0) {
//         console.log(`Could not find univ3 files for ${fromSymbol}/${toSymbol}`);
//         return results;
//     }

//     const dataContents = getUniV3DataContents(selectedFiles, dataDir, sinceBlock);

//     // select base file = the file with the most lines
//     let baseFile = selectedFiles[0];
//     for(let i = 1; i < selectedFiles.length; i++) {
//         const selectedFile = selectedFiles[i];
//         if(Object.keys(dataContents[baseFile]).length < Object.keys(dataContents[selectedFile]).length) {
//             baseFile = selectedFile;
//         }
//     }

//     for(const baseFileBlockNumber of Object.keys(dataContents[baseFile])) {
//         // console.log(`[${targetBlock}] ${baseFile} nearest block value is ${nearestBlockNumber}. Distance: ${targetBlock-nearestBlockNumber}`);
//         results[baseFileBlockNumber] = {
//             blockNumber: baseFileBlockNumber,
//             price: reverse ? dataContents[baseFile][baseFileBlockNumber].p1vs0 : dataContents[baseFile][baseFileBlockNumber].p0vs1,
//         };

//         // clone the data because we need to modify it without modifying the source
//         const baseSlippageMap = {};
//         const baseFileSlippageMap = dataContents[baseFile][baseFileBlockNumber][`${fromSymbol}-slippagemap`];
        
//         let slippageBps = 50;
//         while (slippageBps <= CONSTANT_TARGET_SLIPPAGE * 100) {
//             let slippageValue = baseFileSlippageMap[slippageBps];
            
//             if(!slippageValue) {
//                 // find the closest value that is < slippageBps
//                 const sortedAvailableSlippageBps = Object.keys(baseFileSlippageMap).filter(_ => _ < slippageBps).sort((a,b) => b - a);
//                 if(sortedAvailableSlippageBps.length == 0) {
//                     slippageValue = 0;
//                 } else {
//                     slippageValue = baseFileSlippageMap[sortedAvailableSlippageBps[0]];
//                 } 
//             }

//             baseSlippageMap[slippageBps] = slippageValue;
//             slippageBps += 50;
//         }

//         results[baseFileBlockNumber].slippageMap = baseSlippageMap;

//         // do the same for every other data contents, but only summing the slippagemap
//         for(const filename of selectedFiles) {
//             if(filename == baseFile) {
//                 continue; // base file already done
//             }

//             const blocknumbers = Object.keys(dataContents[filename]);
//             const nearestBlockNumbers = blocknumbers.filter(_ => Number(_) <= baseFileBlockNumber);
//             if(nearestBlockNumbers.length == 0) {
//                 continue; // no available data in source?
//             }

//             const nearestBlockNumber = nearestBlockNumbers.at(-1);
//             // console.log(`[${targetBlock}] ${filename} nearest block value is ${nearestBlockNumber}. Distance: ${targetBlock-nearestBlockNumber}`);
//             const slippageMap = dataContents[filename][nearestBlockNumber][`${fromSymbol}-slippagemap`];
            
//             let slippageBps = 50;
//             while (slippageBps <= CONSTANT_TARGET_SLIPPAGE * 100) {
//                 let volumeToAdd = slippageMap[slippageBps];
//                 if(!volumeToAdd) {
//                     // find the closest value that is < slippageBps
//                     const sortedAvailableSlippageBps = Object.keys(slippageMap).filter(_ => _ < slippageBps).sort((a,b) => b - a);
//                     if(sortedAvailableSlippageBps.length == 0) {
//                         volumeToAdd = 0;
//                     } else {
//                         volumeToAdd = slippageMap[sortedAvailableSlippageBps[0]];
//                     }
//                 } 

//                 results[baseFileBlockNumber].slippageMap[slippageBps] += volumeToAdd;
//                 slippageBps += 50;
//             }
//         }
//     }

//     return results;
// }

function getUniv3PricesForBlockInterval(dataDir, fromSymbol, toSymbol, sinceBlock, toBlock) { 
    console.log(`${fnName()}: Searching for ${fromSymbol}/${toSymbol}`);
    
    const results = {};

    const {selectedFiles, reverse} = getUniV3DataFiles(dataDir, fromSymbol, toSymbol);

    if(selectedFiles.length == 0) {
        console.log(`Could not find univ3 files for ${fromSymbol}/${toSymbol}`);
        return results;
    }

    const dataContents = getUniV3DataContents(selectedFiles, dataDir, sinceBlock);
    // select base file = the file with the most lines
    let primaryFile = selectedFiles[0];
    for(let i = 1; i < selectedFiles.length; i++) {
        const selectedFile = selectedFiles[i];
        if(Object.keys(dataContents[primaryFile]).length < Object.keys(dataContents[selectedFile]).length) {
            primaryFile = selectedFile;
        }
    }

    console.log(`selected file: ${primaryFile} with ${Object.keys(dataContents[primaryFile]).length} values`);

    const result = {};

    for(const [blockNum, data] of Object.entries(dataContents[primaryFile])) {
        if(blockNum > toBlock) {
            continue;
        }
        const price = reverse ? data.p1vs0 : data.p0vs1;
        result[blockNum] = price;
    }

    return result;
}


function computeUniv3ParkinsonVolatility(DATA_DIR, fromSymbol, toSymbol, startBlock, endBlock, daysToAvg) {
    const dataForRange = getUniv3PricesForBlockInterval(DATA_DIR, fromSymbol, toSymbol, startBlock, endBlock);
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

function getAverageLiquidityForBlockInterval(dataDir, fromSymbol, toSymbol, sinceBlock, toBlock) {
    const allData = getUniV3DataforBlockInterval(dataDir, fromSymbol, toSymbol, sinceBlock, toBlock);
    const allDataKeys = Object.keys(allData);
    console.log(`${fnName()}[${fromSymbol}/${toSymbol}]: found ${allDataKeys.length} data since block ${sinceBlock}`);
    if(allDataKeys.length == 0) {
        return null;
    }
    // compute average liquidity
    let sumPrices = 0;
    let dataToUse = allData[allDataKeys[0]];
    const avgSlippageMap = {};

    let cptValues = 0;
    for(let targetBlock = sinceBlock; targetBlock <= toBlock; targetBlock++) {
        cptValues++;
        if(allData[targetBlock]) {
            dataToUse = allData[targetBlock];
        }

        for(const slippageBps of Object.keys(dataToUse.slippageMap)) {
            if(!avgSlippageMap[slippageBps]) {
                avgSlippageMap[slippageBps] = 0;
            }
            avgSlippageMap[slippageBps] += dataToUse.slippageMap[slippageBps];
        }
        
        sumPrices += dataToUse.price;
    }

    for(const slippageBps of Object.keys(avgSlippageMap)) {
        avgSlippageMap[slippageBps] =  avgSlippageMap[slippageBps] / cptValues;
    }

    const priceAvg = sumPrices /  cptValues;
    return {slippageMapAvg: avgSlippageMap, averagePrice: priceAvg};
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

// async function generateConfigOracleAndCompoundAssets() {
//     const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);

//     const bases = ['BAT','DAI','WBTC','USDC','WETH','UNI','COMP','TUSD','LINK','MKR','SUSHI','AAVE','YFI','USDP','FEI','BUSD','MANA','SNX','sUSD'];
//     const quotes = ['WETH', 'USDC', 'WBTC', 'DAI'];
    
//     console.log(JSON.stringify(await generateConfigFromBaseAndQuote(web3Provider, bases, quotes), null, 2));

// }

// generateConfigOracleAndCompoundAssets();

module.exports = { getPriceNormalized, getVolumeForSlippage, getVolumeForSlippageRange, getSlippages, 
    generateConfigFromBaseAndQuote, getAvailableUniswapV3, getUniV3DataFiles, getUniV3DataforBlockRange,
    getUniV3DataContents, getAverageLiquidityForBlockInterval, getUniv3PricesForBlockInterval, computeUniv3ParkinsonVolatility };

// getUniV3DataforBlockRange('./data', 'UNI', 'USDC', [])

