
const BigNumber = require('bignumber.js');
const { roundTo } = require('../utils/utils');

module.exports = { getPrice, getPriceNormalized, getVolumeForSlippage };

function getVolumeForSlippage(targetSlippagePercent, zeroForOne, currentTick, tickSpacing, sqrtPriceX96, liquidity) {
    const priceFunction = zeroForOne ? get_dy : get_dx;

    const baseAmount = new BigNumber(1);
    const basePrice = priceFunction(currentTick, tickSpacing, sqrtPriceX96, liquidity, baseAmount);
    const targetPrice = basePrice.minus(basePrice.times(targetSlippagePercent).div(100));
    // console.log(`base price: ${basePrice}, for ${targetSlippagePercent}% slippage, price: ${targetPrice}`);

    let tryQty = baseAmount.times(2);
    let high = undefined;
    let low = baseAmount;

    const exitBoundsDiff = 1/100; // exit binary search when low and high bound have less than this amount difference

    let lastValidTryQty = undefined;
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const currentVolume = priceFunction(currentTick, tickSpacing, sqrtPriceX96, liquidity, tryQty);
        const currentPrice = currentVolume.div(tryQty);

        // console.log(`[${low} - ${high}]: current price: ${currentPrice}, effectiveSlippage: ${roundTo(Number(basePrice.div(currentPrice).minus(1).times(100)), 2)}%`);
        if(high && low) {
            const variation = high.div(low).minus(1);
            if(variation.lt(exitBoundsDiff)) {
                // console.log(`current price: ${currentPrice}, effectiveSlippage: ${roundTo(Number(basePrice.div(currentPrice).minus(1).times(100)), 2)}%`);
                return tryQty;
            }
        }

        if(currentPrice.gte(targetPrice)) {
            lastValidTryQty = tryQty;
            // if current price to high, need to increase the next tryQty
            // also we can set low = tryQty
            low = tryQty;

            if(high) {
                tryQty = tryQty.plus(high.minus(low).div(2));
            } else {
                tryQty = tryQty.times(2);
            }
        } else {
            // if current price to low, need to decrease the next tryQty
            // also we can set high = tryQty
            high = tryQty;
            
            if(low) {
                tryQty = tryQty.minus(high.minus(low).div(2));
            } else {
                tryQty = tryQty.div(2);
            }
        }
    }

    return lastValidTryQty;
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
    if(zeroForOne) {
        return get_dy(currentTick, tickSpacing, sqrtPriceX96, liquidity, amount);
    } else {
        return get_dx(currentTick, tickSpacing, sqrtPriceX96, liquidity, amount);
    }
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
    if(zeroForOne) {
        const bnAmountOfToken1 = get_dy(currentTick, tickSpacing, sqrtPriceX96, liquidity, amount);
        return bnAmountOfToken1.times(token0DecimalFactor).div(token1DecimalFactor).toNumber();
    } else {
        const bnAmountOfToken0 = get_dx(currentTick, tickSpacing, sqrtPriceX96, liquidity, amount);
        return bnAmountOfToken0.times(token1DecimalFactor).div(token0DecimalFactor).toNumber();
    }
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
    let currTick = Number(currentTick);

    // when selling x, the price goes up
    while(remainingQty.gt(0)) {
        const nextTick = currTick - Number(tickSpacing);
        //console.log({base},{nextTick})
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        const L = new BigNumber(liquidity[currTick]);
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
    let currTick = Number(currentTick);

    // when selling y, the price goes down
    while(remainingQty.gt(0)) {
        const nextTick = currTick + Number(tickSpacing);
        //console.log({base},{nextTick})
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        const L = new BigNumber(liquidity[currTick]);
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