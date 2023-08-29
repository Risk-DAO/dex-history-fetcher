const { computeAggregatedVolumeFromPivot } = require('../../utils/aggregator');
const { getUnifiedDataForInterval, getUnifiedDataForPlatform, getBlankUnifiedData } = require('./data.interface.utils');

const PIVOTS = ['USDC', 'WETH', 'WBTC'];

/**
 * Get the average liquidity in a block interval, for a platform, with or without pivot route jumps
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string} platform
 * @param {bool} withJumps 
 */
function getAverageLiquidityForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform, withJumps) {
    const liquidityDataForInterval = getSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform, withJumps);

    if(!liquidityDataForInterval || Object.keys(liquidityDataForInterval).length == 0) {
        return {avgPrice: 0, avgSlippageMap: getDefaultSlippageMap()};
    }

    const avgData = computeAverageData(liquidityDataForInterval, fromBlock, toBlock);

    return avgData;
}

function getLiquidityForPlatforms(platforms, fromSymbol, toSymbol, fromBlock, toBlock, withJumps = true, stepBlock = 50) {
    const liquidities = [];
    for(const platform of platforms) {
        const liquidity = getSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform, withJumps, stepBlock);
        if(liquidity) {
            liquidities.push(liquidity);
        }
    }

    const aggregData = {};
    for(const blockNumber of Object.keys(liquidities[0])) {
        aggregData[blockNumber] = {
            price: 0,
            slippageMap: getDefaultSlippageMap(),
        };

        let nonZeroPrices = 0;
        for(const liquidityData of liquidities) {
            const liquidityForBlock = liquidityData[blockNumber];
            if(liquidityForBlock.price != 0) {
                nonZeroPrices++;
                aggregData[blockNumber].price += liquidityForBlock.price;
            }

            for(const slippageBps of Object.keys(aggregData[blockNumber].slippageMap)) {
                aggregData[blockNumber].slippageMap[slippageBps] += liquidityForBlock.slippageMap[slippageBps];
            }
        }

        aggregData[blockNumber].price = nonZeroPrices == 0 ? 0 : aggregData[blockNumber].price / nonZeroPrices;
    }

    return aggregData;
}

/**
 * Get the slippage map for a pair
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string} platform
 * @param {bool} withJumps 
 * @param {stepBlock} withJumps 
 * @returns {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform, withJumps, stepBlock=50) {
    // with jumps mean that we will try to add pivot routes (with WBTC, WETH and USDC as pivot)
    if(withJumps) {
        const liquidityDataWithJumps = getSlippageMapForIntervalWithJumps(fromSymbol, toSymbol, fromBlock, toBlock, platform, stepBlock);
        return liquidityDataWithJumps;
    } else {
        const liquidityData = getSimpleSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform, stepBlock);
        return liquidityData;
    }
}


/**
 * Instanciate a default slippage map: from 50 bps to 2000, containing only 0 volume
 * @returns {{[slippageBps: number]: number}}
 */
function getDefaultSlippageMap() {
    const slippageMap = {};
    for(let i = 50; i <= 2000; i+=50) {
        slippageMap[i] = 0;
    }
    return slippageMap;
}

/**
 * Compute average slippage map and price
 * @param {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}} liquidityDataForInterval 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{avgPrice: number, avgSlippageMap: {[slippageBps: number]: number}}
 */
function computeAverageData(liquidityDataForInterval, fromBlock, toBlock) {
    let dataToUse = liquidityDataForInterval[fromBlock];
    const avgSlippageMap = getDefaultSlippageMap();

    let avgPrice = 0;
    let cptValues = 0;
    for (let targetBlock = fromBlock; targetBlock <= toBlock; targetBlock++) {
        cptValues++;
        if (liquidityDataForInterval[targetBlock]) {
            dataToUse = liquidityDataForInterval[targetBlock];
        }

        avgPrice += dataToUse.price;
        for (const slippageBps of Object.keys(avgSlippageMap)) {
            avgSlippageMap[slippageBps] += dataToUse.slippageMap[slippageBps];
        }
    }

    avgPrice = avgPrice / cptValues;

    for (const slippageBps of Object.keys(avgSlippageMap)) {
        avgSlippageMap[slippageBps] = avgSlippageMap[slippageBps] / cptValues;
    }

    return {avgPrice: avgPrice, avgSlippageMap: avgSlippageMap};
}

/**
 * Get the slippage maps for each blocks of the interval
 * Using WBTC, WETH and USDC as pivot to try to find aggregated volumes
 * example, for UNI->USDC, we will add UNI/USDC volume to UNI->WETH->USDC and UNI->WBTC->USDC volumes
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string} platform
 * @returns {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getSimpleSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platform, stepBlock=50) {
    const data = getUnifiedDataForPlatform(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    return data;
}

/**
 * Get the slippage maps for each blocks of the interval using jump routes
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string}  
 * @returns {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getSlippageMapForIntervalWithJumps(fromSymbol, toSymbol, fromBlock, toBlock, platform, stepBlock=50) {
    const liquidityData = {};
    let data = getUnifiedDataForPlatform(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    const pivotData = getPivotUnifiedData(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    if(!data) {
        // if no data and no pivot data, can return undefined: we don't have any liquidity even
        // from jump routes
        if(Object.keys(pivotData).length == 0) {
            return undefined;
        }
        // if no data found for fromSymbol/toSymbol but some pivot data are available, consider base data blank 
        // but we will still try to add "jump routes" to this empty base.
        // Good example is sushiswap COMP/USDC which is an empty pool but we have COMP/WETH and WETH/USDC
        // available. So even if COMP/USDC is empty, we will still use the liquidity from COMP/WETH and WETH/USDC 
        // to get some liquidity for COMP/USDC
        else {
            data = getBlankUnifiedData(fromBlock, toBlock, stepBlock);
        }
    }

    for(const [blockNumber, platformData] of Object.entries(data)) {
        liquidityData[blockNumber] = {
            price: platformData.price,
            slippageMap: getDefaultSlippageMap(),
        };

        const aggregatedSlippageMap = platformData.slippageMap ? structuredClone(platformData.slippageMap) : getDefaultSlippageMap();

        // try to add pivot routes
        for(const pivot of PIVOTS) {
            if(fromSymbol == pivot) {
                continue;
            }
            if(toSymbol == pivot) {
                continue;
            }

            const segment1DataForBlock = getPivotDataForBlock(pivotData, fromSymbol, pivot, blockNumber);
                
            if(!segment1DataForBlock) {
                continue;
            }

            const segment2DataForBlock = getPivotDataForBlock(pivotData, pivot, toSymbol, blockNumber);
            if(!segment2DataForBlock) {
                continue;
            }

            if(!liquidityData[blockNumber].price) {
                const computedPrice = segment1DataForBlock.price * segment2DataForBlock.price;
                liquidityData[blockNumber].price = computedPrice;
            }


            for(const slippageBps of Object.keys(aggregatedSlippageMap)) {
                const aggregVolume = computeAggregatedVolumeFromPivot(segment1DataForBlock.slippageMap, segment1DataForBlock.price, segment2DataForBlock.slippageMap, slippageBps);
                aggregatedSlippageMap[slippageBps] += aggregVolume;
            }
        }

        for(const slippageBps of Object.keys(aggregatedSlippageMap)) {
            const slippageToAdd = aggregatedSlippageMap[slippageBps];
            liquidityData[blockNumber].slippageMap[slippageBps] += slippageToAdd;
        }
    }

    return liquidityData;
}

function getPivotDataForBlock(pivotData, base, quote, blockNumber) {
    if(!pivotData) {
        return undefined;
    }

    if(!pivotData[base]) {
        return undefined;
    }

    if(!pivotData[base][quote]) {
        return undefined;
    }

    if(!pivotData[base][quote][blockNumber]) {
        return undefined;
    }

    return pivotData[base][quote][blockNumber];
}

function getPivotUnifiedData(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock=50) {
    const pivotData = {};

    for (const pivot of PIVOTS) {
        if (fromSymbol == pivot) {
            continue;
        }
        if (toSymbol == pivot) {
            continue;
        }

        const segment1Data = getUnifiedDataForInterval(platform, fromSymbol, pivot, fromBlock, toBlock, stepBlock);
        if (!segment1Data || Object.keys(segment1Data).length == 0) {
            continue;
        }

        const segment2Data = getUnifiedDataForInterval(platform, pivot, toSymbol, fromBlock, toBlock, stepBlock);
        if (!segment2Data || Object.keys(segment2Data).length == 0) {
            continue;
        }

        if (!pivotData[fromSymbol]) {
            pivotData[fromSymbol] = {};
        }

        if (!pivotData[pivot]) {
            pivotData[pivot] = {};
        }

        pivotData[fromSymbol][pivot] = segment1Data;
        pivotData[pivot][toSymbol] = segment2Data;
    }

    return pivotData;
}

module.exports = { getAverageLiquidityForInterval, getSlippageMapForInterval, getLiquidityForPlatforms};