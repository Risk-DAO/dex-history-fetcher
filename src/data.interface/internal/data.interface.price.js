// price related functions

const { DEFAULT_STEP_BLOCK, PLATFORMS } = require('../../utils/constants');
const { arrayAverage, fnName, roundTo } = require('../../utils/utils');
const { computeParkinsonVolatility } = require('../../utils/volatility');
const { getLiquidityForPlatforms } = require('./data.interface.liquidity');
const { getUnifiedDataForInterval, getPricesAtBlockForInterval } = require('./data.interface.utils');

/**
 * Compute the average price from each platform then re-average for all platforms
 * Example: compute average price of WETH/USDC for univ3 and univ2 separately 
 * then compute (average_univ3 + average_univ2) / 2
 * @param {string} fromSymbol base symbol (WETH, USDC...)
 * @param {string} toSymbol quote symbol (WETH, USDC...)
 * @param {number} fromBlock start block of the query (included)
 * @param {number} toBlock endblock of the query (included)
 * @param {string} platform platform (univ2, univ3...)
 * @returns {number} the average price
 */
function getAveragePriceForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform) {
    const data = getUnifiedDataForInterval(platform, fromSymbol, toSymbol, fromBlock, toBlock);
    if(!data) {
        return undefined;
    }
    const priceArray = [];
    for(const dataForBlock of Object.values(data)) {
        priceArray.push(dataForBlock.price);
    }

    const avgPrice = arrayAverage(priceArray);
    return avgPrice;
}

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

    const dataSegment1 = getUnifiedDataForInterval(platform, fromSymbol, pivotSymbol, fromBlock, toBlock, DEFAULT_STEP_BLOCK);

    if(!dataSegment1 || Object.keys(dataSegment1).length == 0) {
        console.log(`${label}: Cannot find data for ${fromSymbol}/${pivotSymbol}, returning 0`);
        return 0;
    }

    const dataSegment2 = getUnifiedDataForInterval(platform, pivotSymbol, toSymbol, fromBlock, toBlock, DEFAULT_STEP_BLOCK);

    if(!dataSegment2 || Object.keys(dataSegment2).length == 0) {
        console.log(`${label}: Cannot find data for ${pivotSymbol}/${toSymbol}, returning 0`);
        return 0;
    }

    // generate the priceAtBlock object
    const priceAtBlock = {};
    for(const [blockNumber, unifiedData] of Object.entries(dataSegment1)) {
        const priceSegment1 = unifiedData.price;
        const priceSegment2 = dataSegment2[blockNumber].price;
        const computedPrice = priceSegment1 * priceSegment2;
        priceAtBlock[blockNumber] = computedPrice;
    }

    const volatility = computeParkinsonVolatility(priceAtBlock, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg);
    console.log(`${label}: volatility found for ${platform}: ${roundTo(volatility*100, 2)}%`);
    return volatility;
}


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
function getParkinsonVolatilityForIntervalAllPlatforms(fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg) {
    const label = `${fnName()}[${fromSymbol}/${toSymbol}] [${fromBlock}-${toBlock}]`;

    // console.log(`${label}: getting data and compute volatility`);

    const data = getLiquidityForPlatforms(PLATFORMS, fromSymbol, toSymbol, fromBlock, toBlock, true, DEFAULT_STEP_BLOCK);

    if(!data || Object.keys(data).length == 0) {
        console.log(`${label}: Cannot find volatility, returning 0`);
        return 0;
    }

    console.log(`${label}: computing parkinson volatility`);
    // generate the priceAtBlock object
    const priceAtBlock = {};
    for(const [blockNumber, unifiedData] of Object.entries(data)) {
        priceAtBlock[blockNumber] = unifiedData.price;
    }

    const volatility = computeParkinsonVolatility(priceAtBlock, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg);
    console.log(`${label}: volatility found for ALL PLATFORMS: ${roundTo(volatility*100, 2)}%`);
    return volatility;
}

function getParkinsonVolatilityForIntervalAllPlatformsViaPivot(fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg, pivotSymbol) {
    const label = `${fnName()}[${fromSymbol}->${pivotSymbol}->${toSymbol}] [${fromBlock}-${toBlock}]`;
    // console.log(`${label}: getting data and compute volatility`);

    const dataSegment1 = getLiquidityForPlatforms(PLATFORMS, fromSymbol, pivotSymbol, fromBlock, toBlock, true, DEFAULT_STEP_BLOCK);

    if(!dataSegment1 || Object.keys(dataSegment1).length == 0) {
        console.log(`${label}: Cannot find data for ${fromSymbol}/${pivotSymbol}, returning 0`);
        return 0;
    }

    const dataSegment2 =  getLiquidityForPlatforms(PLATFORMS, pivotSymbol, toSymbol, fromBlock, toBlock, true, DEFAULT_STEP_BLOCK);

    if(!dataSegment2 || Object.keys(dataSegment2).length == 0) {
        console.log(`${label}: Cannot find data for ${pivotSymbol}/${toSymbol}, returning 0`);
        return 0;
    }

    // generate the priceAtBlock object
    const priceAtBlock = {};
    for(const [blockNumber, unifiedData] of Object.entries(dataSegment1)) {
        const priceSegment1 = unifiedData.price;
        const priceSegment2 = dataSegment2[blockNumber].price;
        const computedPrice = priceSegment1 * priceSegment2;
        priceAtBlock[blockNumber] = computedPrice;
    }

    const volatility = computeParkinsonVolatility(priceAtBlock, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg);
    console.log(`${label}: volatility found for ${PLATFORMS}: ${roundTo(volatility*100, 2)}%`);
    return volatility;
}

module.exports = { getAveragePriceForInterval, getParkinsonVolatilityForInterval, getParkinsonVolatilityForIntervalViaPivot, getParkinsonVolatilityForIntervalAllPlatforms, getParkinsonVolatilityForIntervalAllPlatformsViaPivot };