// price related functions

const { arrayAverage, fnName, roundTo } = require('../../utils/utils');
const { computeParkinsonVolatility } = require('../../utils/volatility');
const { getUnifiedDataForInterval } = require('./data.interface.utils');

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

    console.log(`${label}: getting data and compute volatility`);

    const data = getUnifiedDataForInterval(platform, fromSymbol, toSymbol, fromBlock, toBlock);

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
    console.log(`${label}: volatility found for ${platform}: ${roundTo(volatility*100, 2)}%`);
    return volatility;
}

module.exports = { getAveragePriceForInterval, getParkinsonVolatilityForInterval };