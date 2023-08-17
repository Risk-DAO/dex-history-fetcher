////////////////////////////////////////
/////// THIS IS THE DATA INTERFACE /////
// IT ALLOWS EASY ACCESS TO CSV DATA ///
/// IT SHOULD BE THE ONLY THING USED ///
/// TO ACCESS THE DATA GENERATED BY ////
//////////// THE FETCHERS //////////////

const { getParkinsonVolatilityForInterval, getAveragePriceForInterval } = require('./internal/data.interface.price');
const { getAverageLiquidityForInterval, getSlippageMapForInterval } = require('./internal/data.interface.liquidity');

const ALL_PLATFORMS = ['uniswapv2', 'uniswapv3', 'curve'];


//    _____  _   _  _______  ______  _____   ______        _____  ______     ______  _    _  _   _   _____  _______  _____  ____   _   _   _____ 
//   |_   _|| \ | ||__   __||  ____||  __ \ |  ____|/\    / ____||  ____|   |  ____|| |  | || \ | | / ____||__   __||_   _|/ __ \ | \ | | / ____|
//     | |  |  \| |   | |   | |__   | |__) || |__  /  \  | |     | |__      | |__   | |  | ||  \| || |        | |     | | | |  | ||  \| || (___  
//     | |  | . ` |   | |   |  __|  |  _  / |  __|/ /\ \ | |     |  __|     |  __|  | |  | || . ` || |        | |     | | | |  | || . ` | \___ \ 
//    _| |_ | |\  |   | |   | |____ | | \ \ | |  / ____ \| |____ | |____    | |     | |__| || |\  || |____    | |    _| |_| |__| || |\  | ____) |
//   |_____||_| \_|   |_|   |______||_|  \_\|_| /_/    \_\\_____||______|   |_|      \____/ |_| \_| \_____|   |_|   |_____|\____/ |_| \_||_____/ 
//                                                                                                                                               
//                                                                                                                                               


/**
 * Compute the volatility for an interval of blocks, for a list of platforms
 * @param {string} fromSymbol base symbol (WETH, USDC...)
 * @param {string} toSymbol quote symbol (WETH, USDC...)
 * @param {number} fromBlock start block of the query (included)
 * @param {number} toBlock endblock of the query (included)
 * @param {string[] | undefined} platforms platforms (univ2, univ3...), default to ALL_PLATFORMS
 * @param {number} daysToAvg the number of days the interval spans, used to compute the parkinson's liquidity
 * @returns {number} parkinson's volatility
 */
function getVolatility(fromSymbol, toSymbol, fromBlock, toBlock, platforms, daysToAvg) {
    platforms = checkPlatforms(platforms);
    return getParkinsonVolatilityForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, daysToAvg);
}

/**
 * Compute the average price from each platform then re-average for all platforms
 * Example: compute average price of WETH/USDC for univ3 and univ2 separately 
 * then compute (average_univ3 + average_univ2) / 2
 * @param {string} fromSymbol base symbol (WETH, USDC...)
 * @param {string} toSymbol quote symbol (WETH, USDC...)
 * @param {number} fromBlock start block of the query (included)
 * @param {number} toBlock endblock of the query (included)
 * @param {string[] | undefined} platforms platforms (univ2, univ3...), default to ALL_PLATFORMS
 * @returns {number} the average price
 */
function getAveragePrice(fromSymbol, toSymbol, fromBlock, toBlock, platforms) {
    platforms = checkPlatforms(platforms);
    return getAveragePriceForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms);
}

/**
 * Get the average liquidity in a block interval, for X platforms, with or without pivot route jumps
 * 
 * @param {string} fromSymbol base symbol (WETH, USDC...)
 * @param {string} toSymbol quote symbol (WETH, USDC...)
 * @param {number} fromBlock start block of the query (included)
 * @param {number} toBlock endblock of the query (included)
 * @param {string[] | undefined} platforms platforms (univ2, univ3...), default to ALL_PLATFORMS
 * @param {bool} withJumps default true. pivot route jump: from UNI to MKR, we will add "additional routes" using UNI->USDC->MKR + UNI->WETH->MKR + UNI->WBTC+MKR
 * @returns {{[slippageBps: number]: number}}
 */
function getAverageLiquidity(fromSymbol, toSymbol, fromBlock, toBlock, platforms, withJumps = true) {
    platforms = checkPlatforms(platforms);
    return getAverageLiquidityForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, withJumps);
}

/**
 * Get the slippage maps since fromBlock to toBlock
 * Aggregating from each 'platforms' requested and possibly using "jumps"
 * @param {string} fromSymbol base symbol (WETH, USDC...)
 * @param {string} toSymbol quote symbol (WETH, USDC...)
 * @param {number} fromBlock start block of the query (included)
 * @param {number} toBlock endblock of the query (included)
 * @param {string[] | undefined} platforms platforms (univ2, univ3...), default to ALL_PLATFORMS
 * @param {bool} withJumps default true. pivot route jump: from UNI to MKR, we will add "additional routes" using UNI->USDC->MKR + UNI->WETH->MKR + UNI->WBTC+MKR
 * @param {*} stepBlock default to 50. The amount of block between each data point
 * @returns {{[blockNumber: number]: {[slippageBps: number]: number}}}
 */
function getLiquidity(fromSymbol, toSymbol, fromBlock, toBlock, platforms, withJumps = true, stepBlock = 50) {
    platforms = checkPlatforms(platforms);
    return getSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, withJumps, stepBlock);
}

module.exports = { getVolatility, getAveragePrice, getAverageLiquidity, getLiquidity};


//    _    _  _______  _____  _        _____ 
//   | |  | ||__   __||_   _|| |      / ____|
//   | |  | |   | |     | |  | |     | (___  
//   | |  | |   | |     | |  | |      \___ \ 
//   | |__| |   | |    _| |_ | |____  ____) |
//    \____/    |_|   |_____||______||_____/ 
//                                           
//                                           

function checkPlatforms(platforms) {
    if(!platforms || platforms.length == 0) {
        platforms = ALL_PLATFORMS;
    }

    if(platforms.some(_ => !ALL_PLATFORMS.includes(_))) {
        throw new Error(`At least one platform request is not known: ${platforms.join(',')}`);
    }

    return platforms;
}


module.exports = { getParkinsonVolatilityForInterval, getSlippageMapForInterval, getAverageLiquidityForInterval, getAveragePriceForInterval };