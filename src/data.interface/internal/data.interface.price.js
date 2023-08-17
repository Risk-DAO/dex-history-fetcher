// price related functions

const { arrayAverage, fnName, roundTo } = require('../../utils/utils');
const { computeParkinsonVolatility } = require('../../utils/volatility');
const { getUnifiedDataForInterval, getUnifiedDataForPlatforms } = require('./data.interface.utils');

/**
 * Compute the average price from each platform then re-average for all platforms
 * Example: compute average price of WETH/USDC for univ3 and univ2 separately 
 * then compute (average_univ3 + average_univ2) / 2
 * @param {string} fromSymbol base symbol (WETH, USDC...)
 * @param {string} toSymbol quote symbol (WETH, USDC...)
 * @param {number} fromBlock start block of the query (included)
 * @param {number} toBlock endblock of the query (included)
 * @param {string[]} platforms platforms (univ2, univ3...)
 * @returns {number} the average price
 */
function getAveragePriceForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms) {
    const averages = [];
    for(const platform of platforms) {
        const data = getUnifiedDataForInterval(platform, fromSymbol, toSymbol, fromBlock, toBlock);
        if(!data) {
            return undefined;
        }
        const priceArray = [];
        for(const dataForBlock of Object.values(data)) {
            priceArray.push(dataForBlock.price);
        }

        const avgPrice = arrayAverage(priceArray);
        averages.push(avgPrice);
    }

    const averageForAll = arrayAverage(averages);
    return averageForAll;
}



/**
 * Compute the parkinson's volatility for a pair
 * If 'platforms' is undefined, will find the volatility across all platforms (avg)
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string[] | undefined} platforms 
 * @param {number} daysToAvg the number of days the interval spans
 * @return {number} parkinson's volatility
 */
function getParkinsonVolatilityForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, daysToAvg) {
    const label = `${fnName()}[${fromSymbol}/${toSymbol}] [${fromBlock}-${toBlock}] [${platforms.join(',')}]`;

    console.log(`${label}: getting data for all platforms, will average volatility`);

    const data = getUnifiedDataForPlatforms(platforms, fromSymbol, toSymbol, fromBlock, toBlock);

    if(Object.keys(data).length == 0) {
        console.log(`${label}: Cannot find volatility, returning 0`);
        return 0;
    }

    console.log(`${label}: will compute parkinson volatility from ${Object.keys(data).length} platforms data`);
    const volatilities = [];
    for(const platform of Object.keys(data)) {

        // generate the priceAtBlock object
        const priceAtBlock = {};
        for(const [blockNumber, unifiedData] of Object.entries(data[platform])) {
            priceAtBlock[blockNumber] = unifiedData.price;
        }

        const volatility = computeParkinsonVolatility(priceAtBlock, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg);
        console.log(`${label}: volatility found for ${platform}: ${roundTo(volatility*100, 2)}%`);
        volatilities.push(volatility);
    }

    // return avg volatility
    const avgVolatility = arrayAverage(volatilities);
    console.log(`${label}: returning volatility from platforms ${Object.keys(data)} of ${roundTo(avgVolatility*100, 2)}%`);
    return avgVolatility;
}

module.exports = { getAveragePriceForInterval, getParkinsonVolatilityForInterval };