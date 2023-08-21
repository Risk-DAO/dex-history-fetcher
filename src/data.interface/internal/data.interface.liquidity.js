const { computeAggregatedVolumeFromPivot } = require('../../utils/aggregator');
const { getUnifiedDataForInterval, getUnifiedDataForPlatform } = require('./data.interface.utils');

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
    const data = getUnifiedDataForPlatform(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    if(!data) {
        return undefined;
    }
    
    const pivotData = getPivotUnifiedData(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);

    for(const [blockNumber, platformData] of Object.entries(data)) {
        liquidityData[blockNumber] = {
            price: platformData.price,
            slippageMap: getDefaultSlippageMap(),
        };

        const aggregatedSlippageMap = structuredClone(platformData.slippageMap);
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

module.exports = { getAverageLiquidityForInterval, getSlippageMapForInterval };