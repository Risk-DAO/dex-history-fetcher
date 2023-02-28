
const BigNumber = require('bignumber.js');
const { roundTo, logFnDuration } = require('../utils/utils');

module.exports = { getPrice, getPriceNormalized, getVolumeForSlippage, getVolumeForSlippageRange};

const CONSTANT_1e18 = new BigNumber(10).pow(18);

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
 * For a pool with pair {token0}-{token1}, returns amount of token1 you will receive by trading in 'dx' amount of token0
 * Ex: for the USDC-WETH pool, dx is the amount of USDC to trade in and the function returns the amount of WETH you will receive
 * With uniswap vocabulary, this is the trade "ZeroForOne" -> trade token0 for token1
 * @param {boolean} zeroForOne whether to exchange token0->token1 or token1->token0
 * @param {number} currentTick the current price tick
 * @param {number} tickSpacing tick spacing
 * @param {string} sqrtPriceX96 string representation of sqrtPriceX96
 * @param {{[tick: number]: number}} liquidity liquidities, expressed as ticks
 * @param {BigNumber} dy amount to trade
 * @returns {BigNumber} amount receivable
 */
function getPrice(zeroForOne, currentTick, tickSpacing, sqrtPriceX96, liquidity, amount) {
    return zeroForOne ? 
        get_dy(currentTick, tickSpacing, sqrtPriceX96, liquidity, amount) :
        get_dx(currentTick, tickSpacing, sqrtPriceX96, liquidity, amount);
}


/**
 * For a pool with pair {token0}-{token1}, returns amount of token1 you will receive by trading in 'dx' amount of token0
 * The result will be normalized as a number with the correct decimal place
 * Ex: for the USDC-WETH pool, dx is the amount of USDC to trade in and the function returns the amount of WETH you will receive
 * With uniswap vocabulary, this is the trade "ZeroForOne" -> trade token0 for token1
 * @param {boolean} zeroForOne whether to exchange token0->token1 or token1->token0
 * @param {number} currentTick the current price tick
 * @param {number} tickSpacing tick spacing
 * @param {string} sqrtPriceX96 string representation of sqrtPriceX96
 * @param {{[tick: number]: number}} liquidity liquidities, expressed as ticks
 * @param {BigNumber} dy amount to trade
 * @returns {BigNumber} amount receivable
 */
function getPriceNormalized(zeroForOne, currentTick, tickSpacing, sqrtPriceX96, liquidity, amount, token0Decimals, token1Decimals) {
    const token0DecimalFactor = new BigNumber(10).pow(new BigNumber(token0Decimals));
    const token1DecimalFactor = new BigNumber(10).pow(new BigNumber(token1Decimals));
    const bnAmount = getPrice(zeroForOne, currentTick, tickSpacing, sqrtPriceX96, liquidity, amount);
    return zeroForOne ? 
        bnAmount.times(token0DecimalFactor).div(token1DecimalFactor).toNumber() :
        bnAmount.times(token1DecimalFactor).div(token0DecimalFactor).toNumber();

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

/**
 * For a pool with pair {token0}-{token1}, returns amount of token1 you will receive by trading in 'dx' amount of token0
 * Ex: for the USDC-WETH pool, dx is the amount of USDC to trade in and the function returns the amount of WETH you will receive
 * With uniswap vocabulary, this is the trade "ZeroForOne" -> trade token0 for token1
 * @param {number} currentTick the current price tick
 * @param {number} tickSpacing tick spacing
 * @param {string} sqrtPriceX96 string representation of sqrtPriceX96
 * @param {{[tick: number]: number}} liquidity liquidities, expressed as ticks
 * @param {BigNumber} dy amount to trade
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

        const L = new BigNumber(liquidity[currTick]).times(CONSTANT_1e18);
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

        const L = new BigNumber(liquidity[currTick]).times(CONSTANT_1e18);
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