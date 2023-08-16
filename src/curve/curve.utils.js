
const fs = require('fs');
const readline = require('readline');
const { normalize, getConfTokenBySymbol } = require('../utils/token.utils');
const { tokens } = require('../global.config');
const { BigNumber } = require('ethers');
const { computeParkinsonVolatility } = require('../utils/volatility');
const BIGINT_1e18 = (BigInt(10) ** BigInt(18));


async function getCurvePriceAndLiquidity(dataDir, poolName, fromSymbol, toSymbol, targetBlockNumber) {
    const start = Date.now();

    const liquidityAtBlock = await getCurveDataForBlockNumber(dataDir, poolName, targetBlockNumber);

    console.log(liquidityAtBlock);
    const indexOfFrom = liquidityAtBlock.poolTokens.indexOf(fromSymbol);
    const indexOfTo = liquidityAtBlock.poolTokens.indexOf(toSymbol);

    const reservesBigIntWei = [];
    for(let i = 0; i < liquidityAtBlock.reserves.length; i++) {
        const token = liquidityAtBlock.poolTokens[i];
        const reserve = liquidityAtBlock.reserves[i];
        const decimals = tokens[token].decimals;
        const reserveInWei = reserve + ''.padEnd(18 - decimals, '0');
        reservesBigIntWei.push(BigInt(reserveInWei));
    }
    // console.log('reservesBigIntWei:', reservesBigIntWei);

    const baseQty = BigInt(1e10);
    const baseGetReturn = get_return(indexOfFrom, indexOfTo, baseQty, reservesBigIntWei, liquidityAtBlock.amplificationFactor);
    const normalizedBasePrice = normalize(BigNumber.from(baseGetReturn), 18) * 1e8;
    console.log(`getCurvePriceAndLiquidity: 1 ${fromSymbol} = ${normalizedBasePrice} ${toSymbol} at block ${liquidityAtBlock.blockNumber}`);

    const result = {
        closestBlock: liquidityAtBlock.blockNumber,
        from: fromSymbol,
        to: toSymbol,
        priceAtBlock: normalizedBasePrice,
        amplificationFactor: liquidityAtBlock.amplificationFactor,
        slippageMap: {}
    };

    
    for(let i = 1; i < 100; i++) {
        const targetSlippage = i/100;
        const targetPrice = normalizedBasePrice - (normalizedBasePrice * targetSlippage);
        // console.log(`Computing liquidity for ${i}% slippage`);
        const amountOfFromForSlippage = computeLiquidityForSlippageCurvePool(fromSymbol, toSymbol, baseQty, targetPrice, reservesBigIntWei, indexOfFrom, indexOfTo, liquidityAtBlock.amplificationFactor);
        result.slippageMap[i] = normalize(BigNumber.from(amountOfFromForSlippage), 18);
    }

    // console.log(result);
    console.log('getCurvePriceAndLiquidity: duration for pool', poolName, ':', Date.now() - start);
    return result;
}

async function getCurveDataForBlockNumber(dataDir, poolName, targetBlockNumber) {
    const filePath = getCurveDataFile(dataDir, poolName);
    if(!filePath) {
        throw new Error(`Could not find pool data in ${dataDir}/curve/${poolName} for curve`);
    }
    
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });


    let first = true;
    let selectedValue = null;
    const poolTokens = [];
    for await (const line of rl) {
        if(first) {
            first = false;
            const splitted = line.split(',');
            for(let i = 2; i < splitted.length; i++) {
                poolTokens.push(splitted[i].split('_')[1]);
            }

        } else {
            const splitted = line.split(',');
            const blockNumber = Number(splitted[0]);
            const amplificationFactor = Number(splitted[1]);
            const reserves = [];
            
            for(let i = 2; i < splitted.length; i++) {
                reserves.push(splitted[i]);
            }

            // init selected value with first line
            if(!selectedValue) {
                selectedValue = {
                    blockNumber,
                    amplificationFactor,
                    poolTokens,
                    reserves
                };
            }

            if(blockNumber == targetBlockNumber) {
                // stop loop we found the exact block number
                selectedValue = {
                    blockNumber,
                    amplificationFactor,
                    poolTokens,
                    reserves
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
                        amplificationFactor,
                        poolTokens,
                        reserves
                    };
                }
                // here we break, returning either the current value or the last one
                break; 
            }
            // by default just save the last value as selected value
            selectedValue = {
                blockNumber,
                amplificationFactor,
                poolTokens,
                reserves
            };
        }
        // console.log('line:', line);    

    }

    fileStream.close();

    return {
        blockNumber: selectedValue.blockNumber,
        amplificationFactor: selectedValue.amplificationFactor,
        poolTokens: poolTokens,
        reserves: selectedValue.reserves,
    };
}


function getCurveDataSinceBlock(dataDir, poolName, sinceBlock) {
    const filePath = getCurveDataFile(dataDir, poolName);
    if(!filePath) {
        throw new Error(`Could not find pool data in ${dataDir}/curve/${poolName} for curve`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');

    let lastLine = undefined;
    const poolTokens = [];
    const results = {};

    const headers = fileContent[0];

    const splitted = headers.split(',');
    for(let i = 3; i < splitted.length; i++) {
        poolTokens.push(splitted[i].split('_')[1]);
    }

    for(let i = 1; i < fileContent.length - 1; i++) {
        const line = fileContent[i];
        const splitted = line.split(',');
        const blockNumber = Number(splitted[0]);
        if(blockNumber >= sinceBlock) {
            if(blockNumber == sinceBlock) {
                lastLine = '';
            }

            // save the last line if not undefined
            if(lastLine) {
                const lastLineSplitted = lastLine.split(',');
                const lastLineBlockNumber = Number(lastLineSplitted[0]);
                const lastLineAmplificationFactor = Number(lastLineSplitted[1]);
                const lastLineLpTokenReserve = lastLineSplitted[2];
                const lastLineReserves = [];
                
                for(let i = 3; i < lastLineSplitted.length; i++) {
                    lastLineReserves.push(lastLineSplitted[i]);
                }

                results[lastLineBlockNumber] = {
                    blockNumber: lastLineBlockNumber,
                    lpTokenReserve: lastLineLpTokenReserve,
                    ampFactor: lastLineAmplificationFactor,
                    reserves: lastLineReserves
                };

                lastLine = undefined;
            }

            // save current value
            const lineSplitted = line.split(',');
            const ampFactor = Number(lineSplitted[1]);
            const lpTokenReserves = lineSplitted[2];
            const reserves = [];
            
            for(let i = 3; i < lineSplitted.length; i++) {
                reserves.push(lineSplitted[i]);
            }
            results[blockNumber] = {
                blockNumber: blockNumber,
                lpTokenReserve: lpTokenReserves,
                ampFactor: ampFactor,
                reserves: reserves
            };
        } else {
            // save last line if before sinceBlock
            lastLine = line;
        }
    }

    return {
        tokens: poolTokens,
        reserves: results,
    };
}

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

function getCurveDataforBlockRange(dataDir, poolName, blockRange) {
    const filePath = getCurveDataFile(dataDir, poolName);
    if(!filePath) {
        throw new Error(`Could not find pool data in ${dataDir}/curve/${poolName} for curve`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');

    let lastLine = undefined;
    const poolTokens = [];
    const results = {};
    let targetBlockNumberIndex = 0;
    let targetBlockNumber = blockRange[targetBlockNumberIndex];


    let mustStop = false;
    for(let l = 0; l < fileContent.length -1; l++) {
        const line = fileContent[l];
        if(mustStop) {
            break;
        }

        if(l == 0) {
            const splitted = line.split(',');
            for(let i = 3; i < splitted.length; i++) {
                poolTokens.push(splitted[i].split('_')[1]);
            }
            continue;
        }

        if(!lastLine) {
            // first real line is just saved
            lastLine = line;
            continue;
        }
    
        const splitted = line.split(',');
        const blockNumber = Number(splitted[0]);

        // if the current block number is higher than the target block number
        // save the lastLine result as the closest valid value
        if(blockNumber > targetBlockNumber) {
            const lastLineSplitted = lastLine.split(',');
            const amplificationFactor = Number(lastLineSplitted[1]);
            const lpTokenReserve = lastLineSplitted[2];
            const reserves = [];
            
            for(let i = 3; i < lastLineSplitted.length; i++) {
                reserves.push(lastLineSplitted[i]);
            }

            while(targetBlockNumber < blockNumber) {
                results[targetBlockNumber] = {
                    blockNumber: blockNumber,
                    lpTokenReserve: lpTokenReserve,
                    ampFactor: amplificationFactor,
                    reserves: reserves
                };


                targetBlockNumberIndex++;
                if(targetBlockNumberIndex == blockRange.length) {
                    mustStop = true;
                    break;
                }

                targetBlockNumber = blockRange[targetBlockNumberIndex];
            }
        }

        lastLine = line;

    }

    return {
        tokens: poolTokens,
        reserves: results,
    };
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
 * 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {BigInt} baseQty 
 * @param {number} basePrice 
 * @param {number} targetPrice 
 * @param {BigInt[]} reserves 
 * @param {number} i 
 * @param {number} j 
 * @param {number} amplificationFactor
 */
function computeLiquidityForSlippageCurvePool(fromSymbol, toSymbol, baseQty, targetPrice, reserves, i, j, amplificationFactor) {
    let low = undefined;
    let high = undefined;
    let qtyFrom = baseQty * 2n;
    const exitBoundsDiff = 0.1/100; // exit binary search when low and high bound have less than this amount difference
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const qtyTo = get_return(i, j, qtyFrom, reserves, amplificationFactor);
        const normalizedFrom = normalize(BigNumber.from(qtyFrom), 18);
        const normalizedTo = normalize(BigNumber.from(qtyTo), 18);
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
function get_virtual_price(xp, N_COINS, A, tokenSupply) {
    const D = get_D(xp, N_COINS, A);
    return normalize(D.toString(), 18) / tokenSupply;
}


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
 * @param {string} lpSupply 
 * @param {string[]} reserves 
 */
function computePriceAndSlippageMapForReserveValue(fromSymbol, toSymbol, poolTokens, ampFactor, lpSupply, reserves) {
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
        const liquidityAtSlippage = normalize(computeLiquidityForSlippageCurvePool(fromSymbol, toSymbol, BIGINT_1e18, targetPrice, reservesNorm18Dec, indexFrom, indexTo, ampFactor).toString(), 18);
        
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

function getCurvePoolPricesForBlockInterval(DATA_DIR, poolName, fromSymbol, toSymbol, startBlock, endBlock) {
    const dataForRange = getCurveDataSinceBlock(DATA_DIR, poolName, startBlock);
    const results = {};
    const tokens = [];
    for (const token of dataForRange.tokens) {
        tokens.push(getConfTokenBySymbol(token));
    }
    
    const indexFrom = dataForRange.tokens.indexOf(fromSymbol);
    const indexTo = dataForRange.tokens.indexOf(toSymbol);

    for(const [blockNumber, data] of Object.entries(dataForRange.reserves)) {
        if(blockNumber > endBlock) {
            continue;
        }

        const reservesNorm18Dec = getReservesNormalizedTo18Decimals(tokens, data.reserves);
        const returnVal = get_return(indexFrom, indexTo, BIGINT_1e18, reservesNorm18Dec, data.ampFactor);
        const basePrice = normalize(returnVal.toString(), 18);
        results[blockNumber] = basePrice;
    }

    return results;
}

function computeCurvePoolParkinsonVolatility(DATA_DIR, poolName, fromSymbol, toSymbol, startBlock, endBlock, daysToAvg) {
    const dataForRange = getCurvePoolPricesForBlockInterval(DATA_DIR, poolName, fromSymbol, toSymbol, startBlock, endBlock);
    // console.log(dataForRange);
    
    return computeParkinsonVolatility(dataForRange, fromSymbol, toSymbol, startBlock, endBlock, daysToAvg);
}

// console.log('curve parkinson liquidity DAI/USDC:', computeCurvePoolParkinsonVolatility('./data', '3Pool_3Crv', 'DAI', 'USDC', 17469815, 17683325, 30));


module.exports = { getCurvePriceAndLiquidity, get_return, get_virtual_price, computeLiquidityForSlippageCurvePool, getAvailableCurve,
    getCurveDataforBlockRange, getReservesNormalizedTo18Decimals, computeCurvePoolParkinsonVolatility, getCurveDataforBlockInterval,
    computePriceAndSlippageMapForReserveValue };

// function test() {
//     getCurvePriceAndLiquidity('./data', '3pool', 'DAI', 'USDC', 15487);
//     // const daiQty = BigInt('226606265000000000000000000' + ''.padEnd(18 - 18, '0'));
//     // const usdcQty = BigInt('232457084000000' + ''.padEnd(18 - 6, '0'));
//     // const usdtQty = BigInt('77289259000000' + ''.padEnd(18 - 6, '0'));
//     // const A = 2000;

//     // const reservePad = [
//     //     daiQty,
//     //     usdcQty,
//     //     usdtQty
//     // ];


//     // const tokenToExchange = 1;
//     // const r = getReturn(0, 1, toWei(tokenToExchange), reservePad, A);
//     // const norm = Number(r/(10n**18n));
//     // console.log(norm);
//     // const fees = 0.01/100;
//     // const feesVal = norm * fees;
//     // console.log(norm-feesVal);
// }

// test();
