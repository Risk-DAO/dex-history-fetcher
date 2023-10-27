// price related functions

const { fnName, roundTo } = require('../../utils/utils');
const { computeParkinsonVolatility } = require('../../utils/volatility');
const { getPricesAtBlockForInterval } = require('./data.interface.utils');


/**
 * Compute the parkinson's volatility for a pair and a platform
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string} platform
 * @param {number} daysToAvg the number of days the interval spans
 * @return {number} parkinson's volatility
 */
function getParkinsonVolatilityForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform, daysToAvg) {
    const label = `${fnName()}[${fromSymbol}/${toSymbol}] [${fromBlock}-${toBlock}] [${platform}]`;

    // console.log(`${label}: getting data and compute volatility`);

    const priceAtBlock = getPricesAtBlockForInterval(platform, fromSymbol, toSymbol, fromBlock, toBlock);

    if(!priceAtBlock || Object.keys(priceAtBlock).length == 0) {
        console.log(`${label}: Cannot find volatility, returning 0`);
        return 0;
    }

    const volatility = computeParkinsonVolatility(priceAtBlock, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg);
    console.log(`${label}: volatility found for ${platform}: ${roundTo(volatility*100, 2)}%`);
    return volatility;
}

/**
 * Compute the liquidity of a pair (MKR/USDC) using a pivot (WETH)
 * Find the price for MKR/WETH (segment1) and WETH/USDC (segment2)
 * and generate the price of MKR/USDC for each block
 * @param {*} fromSymbol 
 * @param {*} toSymbol 
 * @param {*} fromBlock 
 * @param {*} toBlock 
 * @param {*} platform 
 * @param {*} daysToAvg 
 * @param {*} pivotSymbol 
 * @returns 
 */
function getParkinsonVolatilityForIntervalViaPivot(fromSymbol, toSymbol, fromBlock, toBlock, platform, daysToAvg, pivotSymbol) {
    const label = `${fnName()}[${fromSymbol}->${pivotSymbol}->${toSymbol}] [${fromBlock}-${toBlock}] [${platform}]`;
    // console.log(`${label}: getting data and compute volatility`);

    const dataSegment1 = getPricesAtBlockForInterval(platform, fromSymbol, pivotSymbol, fromBlock, toBlock);

    if(!dataSegment1 || Object.keys(dataSegment1).length == 0) {
        console.log(`${label}: Cannot find data for ${fromSymbol}/${pivotSymbol}, returning 0`);
        return 0;
    }

    const dataSegment2 = getPricesAtBlockForInterval(platform, pivotSymbol, toSymbol, fromBlock, toBlock);

    if(!dataSegment2 || Object.keys(dataSegment2).length == 0) {
        console.log(`${label}: Cannot find data for ${pivotSymbol}/${toSymbol}, returning 0`);
        return 0;
    }

    // generate the priceAtBlock object
    const priceAtBlock = {};
    const keysSegment2 = Object.keys(dataSegment2).map(_ => Number(_));
    for(const [blockNumber, priceSegment1] of Object.entries(dataSegment1)) {
        const blocksBeforeSegment2 = keysSegment2.filter(_ => _ <= Number(blockNumber));
        if(blocksBeforeSegment2.length == 0) {
            continue;
        }

        // take the last, meaning it's the closest to 'blockNumber' from segment1
        const nearestBlockNumberSegment2 = blocksBeforeSegment2.at(-1);
        const priceSegment2 = dataSegment2[nearestBlockNumberSegment2];
        const computedPrice = priceSegment1 * priceSegment2;
        priceAtBlock[blockNumber] = computedPrice;
    }

    const volatility = computeParkinsonVolatility(priceAtBlock, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg);
    console.log(`${label}: volatility found for ${platform}: ${roundTo(volatility*100, 2)}%`);
    return volatility;
}


module.exports = { getParkinsonVolatilityForInterval, getParkinsonVolatilityForIntervalViaPivot };