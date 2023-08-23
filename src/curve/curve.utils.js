
const fs = require('fs');
const { normalize, getConfTokenBySymbol } = require('../utils/token.utils');
const BIGINT_1e18 = (BigInt(10) ** BigInt(18));

function getCurveDataforBlockInterval(dataDir, poolName, startBlock, endBlock) {
    const filePath = getCurveDataFile(dataDir, poolName);
    if(!filePath) {
        throw new Error(`Could not find pool data in ${dataDir}/curve/${poolName} for curve`);
    }
    
    const dataContents = {
        poolTokens: [], // ORDERED
        reserveValues: {},
    };

    // load the file in RAM
    const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');


    // header looks like: 
    // blocknumber,ampfactor,lp_supply_0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490,reserve_DAI_0x6B175474E89094C44Da98b954EedeAC495271d0F,reserve_USDC_0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,reserve_USDT_0xdAC17F958D2ee523a2206206994597C13D831ec7
    const headersSplitted = fileContent[0].split(',');
    for(let i = 3; i < headersSplitted.length; i++) {
        // save the symbol value into pool tokens
        dataContents.poolTokens.push(headersSplitted[i].split('_')[1]);
    }
    

    let lastValue = undefined;
    for(let i = 1; i < fileContent.length - 1; i++) {
        const line = fileContent[i];
        const splt = line.split(',');
        const blockNum = Number(splt[0]);

        if(blockNum > endBlock) {
            break;
        }

        // if blockNum inferior to startBlock, ignore but save last value
        if(blockNum < startBlock) {
            lastValue = {
                blockNumber: blockNum,
                lineValue: line.toString(),
            };
        } else {
            // here it means we went through the sinceBlock, save the last value before 
            // reaching sinceBlock to have one previous data
            if(lastValue && blockNum != startBlock) {
                const beforeValueSplitted = lastValue.lineValue.split(',');
                const lastValueBlock = lastValue.blockNumber;

                dataContents.reserveValues[lastValueBlock] = {
                    ampFactor: Number(beforeValueSplitted[1]),
                    lpSupply: beforeValueSplitted[2]
                };

                for(let i = 3; i < beforeValueSplitted.length; i++) {
                    const token = dataContents.poolTokens[i-3];
                    dataContents.reserveValues[lastValueBlock][token] = beforeValueSplitted[i];
                }

                // set lastValue to null, meaning we already saved it
                lastValue = null;
            }

            // save current value
            dataContents.reserveValues[blockNum] = {
                ampFactor: Number(splt[1]),
                lpSupply: splt[2]
            };

            for(let i = 3; i < splt.length; i++) {
                const token = dataContents.poolTokens[i-3];
                dataContents.reserveValues[blockNum][token] = splt[i];
            }
        }

    }

    return dataContents;
}

function getCurveDataFile(dataDir, poolName) {
    let path = `${dataDir}/curve/${poolName}_curve.csv`;

    if(fs.existsSync(path)) {
        return path;
    } else {
        return null;
    }
}

/**
 * Find the liquidity for slippage using curve data
 * Use binary search to find the value
 * @param {BigInt} baseQty 
 * @param {number} basePrice 
 * @param {number} targetPrice 
 * @param {BigInt[]} reserves 
 * @param {number} i 
 * @param {number} j 
 * @param {number} amplificationFactor
 */
function computeLiquidityForSlippageCurvePool(baseQty, targetPrice, reserves, i, j, amplificationFactor) {
    let low = undefined;
    let high = undefined;
    let qtyFrom = baseQty * 2n;
    const exitBoundsDiff = 0.1/100; // exit binary search when low and high bound have less than this amount difference
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const qtyTo = get_return(i, j, qtyFrom, reserves, amplificationFactor);
        const normalizedFrom = normalize(qtyFrom.toString(), 18);
        const normalizedTo = normalize(qtyTo.toString(), 18);
        const currentPrice = normalizedTo / normalizedFrom;

        const variation = (Number(high) / Number(low)) - 1;
        // console.log(`DAI Qty: [${low ? normalize(BigNumber.from(low), 18) : '0'} <-> ${high ? normalize(BigNumber.from(high), 18) : '+∞'}]. Current price: 1 ${fromSymbol} = ${currentPrice} ${toSymbol}, targetPrice: ${targetPrice}. Try qty: ${normalizedFrom} ${fromSymbol} = ${normalizedTo} ${toSymbol}. variation: ${variation * 100}%`);
        if(low && high) {
            if(variation < exitBoundsDiff) {
                return (high + low) / 2n;
            }
        }

        if (currentPrice > targetPrice) {
            // current price too high, must increase qtyFrom
            low = qtyFrom;

            if(!high) {
                // if high is undefined, just double next try qty
                qtyFrom = qtyFrom * 2n;
            } else {
                qtyFrom = qtyFrom + ((high - low) / 2n);
            }
        } else {
            // current price too low, must decrease qtyFrom
            high = qtyFrom;

            if(!low) {
                // if low is undefined, next try qty = qty / 2
                qtyFrom = qtyFrom / 2n;
            } else {
                qtyFrom = qtyFrom - ((high - low) / 2n);
            }
        }
    }
}

/* CURVE PRICE ALGORITHM FUNCTIONS */

/**
 * get the virtual price
 * @param {BigInt[]} xp array of balances, all in 'wei' (1e18)
 * @param {BigInt} N_COINS number of coins
 * @param {BigInt} A Amplification factor
 * @param {number} tokenSupply normalized token total supply
 * @returns {number} virtual price with good decimal place
 */
// function get_virtual_price(xp, N_COINS, A, tokenSupply) {
//     const D = get_D(xp, N_COINS, A);
//     return normalize(D.toString(), 18) / tokenSupply;
// }


/**
 * 
 * @param {BigInt[]} xp array of balances, all in 'wei' (1e18)
 * @param {BigInt} N_COINS number of coins
 * @param {BigInt} A Amplification factor
 * @returns 
 */
function get_D(xp, N_COINS, A) {
    let S = 0n;
    for (const _x of xp) {
        S += _x;
    }

    if (S == 0)
        return 0;    

    let Dprev = 0;
    let D = S;
    const Ann = A * N_COINS;
    for (let _i = 0 ; _i < 255 ; _i++) {
        let D_P = D;
        for (const _x of xp)
            D_P = D_P * D / (_x * N_COINS + 1n);  // +1 is to prevent /0
        Dprev = D;
        D = (Ann * S + D_P * N_COINS) * D / ((Ann - 1n) * D + (N_COINS + 1n) * D_P);
        // Equality with the precision of 1
        if (D > Dprev)
            if (D - Dprev <= 1n)
                break;
            else
            if (Dprev - D <= 1n)
                break;
    }
    return D;
}

function get_y(i, j, x, _xp, N_COINS, A) {
    // x in the input is converted to the same price/precision
    //assert (i != j) and (i >= 0) and (j >= 0) and (i < N_COINS) and (j < N_COINS)

    const D = get_D(_xp, N_COINS, A);
    let c = D;
    let S_ = 0n;
    const Ann = A * N_COINS;

    let _x = 0n;
    for (let _i = 0 ; _i < N_COINS ; _i++) {
        if (_i == i)
            _x = x;
        else if (_i != j)
            _x = _xp[_i];
        else
            continue;
        S_ += _x;
        c = c * D / (_x * N_COINS);
    }
    c = c * D / (Ann * N_COINS);
    const b = S_ + D / Ann;  // - D
    let y_prev = 0n;
    let y = D;
    for (let _i = 0 ; _i < 255 ; _i++) {
        y_prev = y;
        y = (y*y + c) / (2n * y + b - D);
        // Equality with the precision of 1
        if (y > y_prev)
            if (y - y_prev <= 1n)
                break;
            else
            if (y_prev - y <= 1n)
                break;
    }

    return _xp[j] - y;
}

/**
 * get the amount of token j you will receive when selling 'x' amount of i
 * all amount should be with the same precision, in wei preferably (1e18 decimals)
 * @param {number} i position (in 'balances' array) of token to sell
 * @param {number} j position (in 'balances' array) of token to buy
 * @param {BigInt} x amount of token i to sell in wei (1e18 decimals)
 * @param {BigInt[]} balances balances of each coins in the pool, in wei (1e18 decimals)
 * @param {number} A amplification factor of the pool
 * @returns 
 */
function get_return(i, j, x, balances, A) {
    return get_y(i, j, x + balances[i], balances, BigInt(balances.length), BigInt(A));
}

function getAvailableCurve(dataDir) {
    const summary = JSON.parse(fs.readFileSync(`${dataDir}/curve/curve_pools_summary.json`));
    const available = {};
    for (const poolName of Object.keys(summary)) {
        for (const [token, reserveValue] of Object.entries(summary[poolName])) {
            if (!available[token]) {
                available[token] = {};
            }

            for (const [tokenB, reserveValueB] of Object.entries(summary[poolName])) {
                if (tokenB === token) {
                    continue;
                }

                available[token][tokenB] = available[token][tokenB] || {};
                available[token][tokenB][poolName] = available[token][tokenB][poolName] || {};
                available[token][tokenB][poolName][token] = reserveValue;
                available[token][tokenB][poolName][tokenB] = reserveValueB;
            }
        }
    }
    return available;
}

/**
 * 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {string[]} poolTokens 
 * @param {number} ampFactor
 * @param {string[]} reserves 
 */
function computePriceAndSlippageMapForReserveValue(fromSymbol, toSymbol, poolTokens, ampFactor, reserves) {
    if(poolTokens.length != reserves.length) {
        throw new Error('Tokens array must be same length as reserves array');
    }

    const tokenConfs = [];
    for(const poolToken of poolTokens) {
        tokenConfs.push(getConfTokenBySymbol(poolToken));
    }

    const reservesNorm18Dec = getReservesNormalizedTo18Decimals(tokenConfs, reserves);
    
    const indexFrom = poolTokens.indexOf(fromSymbol);
    const indexTo = poolTokens.indexOf(toSymbol);
    const returnVal = get_return(indexFrom, indexTo, BIGINT_1e18, reservesNorm18Dec, ampFactor);
    const price = normalize(returnVal.toString(), 18);
    const slippageMap = {};
    for(let slippageBps = 50; slippageBps <= 2000; slippageBps += 50) {
        const targetPrice = price - (price * slippageBps / 10000);
        const liquidityAtSlippage = normalize(computeLiquidityForSlippageCurvePool(BIGINT_1e18, targetPrice, reservesNorm18Dec, indexFrom, indexTo, ampFactor).toString(), 18);
        
        slippageMap[slippageBps] = liquidityAtSlippage;
    }

    return {price, slippageMap};
}

/**
 * 
 * @param {tokenConf[]} tokens 
 * @param {string[]} reserves 
 * @returns 
 */
function getReservesNormalizedTo18Decimals(tokens, reserves) {
    if(tokens.length != reserves.length) {
        throw new Error('Tokens array must be same length as reserves array');
    }
    const reservesNorm = [];

    for(let i = 0; i < reserves.length; i++) {
        const tokenReserve18DecimalStr = reserves[i] + ''.padEnd(18 - tokens[i].decimals, '0');
        reservesNorm.push(BigInt(tokenReserve18DecimalStr));
    }

    return reservesNorm;
}

module.exports = { getAvailableCurve, getCurveDataforBlockInterval, computePriceAndSlippageMapForReserveValue };
