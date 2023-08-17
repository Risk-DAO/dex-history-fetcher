const { computeAggregatedVolumeFromPivot } = require('../../utils/aggregator');
const { getUnifiedDataForPlatforms, getUnifiedDataForInterval } = require('./data.interface.utils');

const PIVOTS = ['USDC', 'WETH', 'WBTC'];

/**
 * Get the average liquidity in a block interval, for X platforms, with or without pivot route jumps
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string[]} platforms 
 * @param {bool} withJumps 
 */
function getAverageLiquidityForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, withJumps) {
    const slippageMapForInterval = getSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, withJumps);

    if(Object.keys(slippageMapForInterval).length == 0) {
        return getDefaultSlippageMap();
    }

    const avgSlippageMap = computeAverageSlippageMap(slippageMapForInterval, fromBlock, toBlock);

    return avgSlippageMap;
}

/**
 * Get the slippage map for a pair
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string[]} platforms 
 * @param {bool} withJumps 
 * @param {stepBlock} withJumps 
 */
function getSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, withJumps, stepBlock=50) {
    // with jumps mean that we will try to add pivot routes (with WBTC, WETH and USDC as pivot)
    if(withJumps) {
        const sumSlippageMapsCombined = getCombinedSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, stepBlock);
        return sumSlippageMapsCombined;
    } else {
        const sumSlippageMaps = getSimpleSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, stepBlock);
        return sumSlippageMaps;
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

function computeAverageSlippageMap(slippageMapForInterval, fromBlock, toBlock) {
    let dataToUse = slippageMapForInterval[fromBlock];
    const avgSlippageMap = getDefaultSlippageMap();

    let cptValues = 0;
    for (let targetBlock = fromBlock; targetBlock <= toBlock; targetBlock++) {
        cptValues++;
        if (slippageMapForInterval[targetBlock]) {
            dataToUse = slippageMapForInterval[targetBlock];
        }

        for (const slippageBps of Object.keys(dataToUse)) {
            avgSlippageMap[slippageBps] += dataToUse[slippageBps];
        }
    }

    for (const slippageBps of Object.keys(avgSlippageMap)) {
        avgSlippageMap[slippageBps] = avgSlippageMap[slippageBps] / cptValues;
    }
    return avgSlippageMap;
}

/**
 * Get the slippage maps for each blocks of the interval
 * Using WBTC, WETH and USDC as pivot to try to find aggregated volumes
 * example, for UNI->USDC, we will add UNI/USDC volume to UNI->WETH->USDC and UNI->WBTC->USDC volumes
 * Summing the slippage map for each platforms
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string[]} platforms 
 * @returns {{[blocknumber: number]: {[slippageBps: number]: number}}}
 */
function getSimpleSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, stepBlock=50) {
    const blocksSlippageMaps = {};
    const data = getUnifiedDataForPlatforms(platforms, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    for(const platform of Object.keys(data)) {
        for(const [blockNumber, platformData] of Object.entries(data[platform])) {
            if(!blocksSlippageMaps[blockNumber]) {
                blocksSlippageMaps[blockNumber] = getDefaultSlippageMap();
            }

            for(const slippageBps of Object.keys(platformData.slippageMap)) {
                const slippageToAdd = platformData.slippageMap[slippageBps];
                blocksSlippageMaps[blockNumber][slippageBps] += slippageToAdd;
            }
        }
    }

    return blocksSlippageMaps;
}

/**
 * Get the slippage maps for each blocks of the interval
 * Summing the slippage map for each platforms
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {string[]} platforms 
 * @returns {{[blocknumber: number]: {[slippageBps: number]: number}}}
 */
function getCombinedSlippageMapForInterval(fromSymbol, toSymbol, fromBlock, toBlock, platforms, stepBlock=50) {
    const blocksSlippageMaps = {};
    const data = getUnifiedDataForPlatforms(platforms, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);

    const pivotData = getPivotUnifiedData(data, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);

    for(const platform of Object.keys(data)) {
        for(const [blockNumber, platformData] of Object.entries(data[platform])) {
            if(!blocksSlippageMaps[blockNumber]) {
                blocksSlippageMaps[blockNumber] = getDefaultSlippageMap();
            }

            const aggregatedSlippageMap = structuredClone(platformData.slippageMap);
            // try to add pivot routes
            for(const pivot of PIVOTS) {
                if(fromSymbol == pivot) {
                    continue;
                }
                if(toSymbol == pivot) {
                    continue;
                }

                const segment1DataForBlock = getPivotDataForBlock(pivotData, platform, fromSymbol, pivot, blockNumber);
                
                if(!segment1DataForBlock) {
                    continue;
                }

                const segment2DataForBlock = getPivotDataForBlock(pivotData, platform, pivot, toSymbol, blockNumber);
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
                blocksSlippageMaps[blockNumber][slippageBps] += slippageToAdd;
            }
        }
    }

    return blocksSlippageMaps;
}

function getPivotDataForBlock(pivotData, platform, base, quote, blockNumber) {
    if(!pivotData[platform]) {
        return undefined;
    }

    if(!pivotData[platform][base]) {
        return undefined;
    }

    if(!pivotData[platform][base][quote]) {
        return undefined;
    }

    if(!pivotData[platform][base][quote][blockNumber]) {
        return undefined;
    }

    return pivotData[platform][base][quote][blockNumber];
}

function getPivotUnifiedData(data, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock=50) {
    const pivotData = {};

    for (const platform of Object.keys(data)) {
        for (const pivot of PIVOTS) {
            if (fromSymbol == pivot) {
                continue;
            }
            if (toSymbol == pivot) {
                continue;
            }

            const segment1Data = getUnifiedDataForInterval(platform, fromSymbol, pivot, fromBlock, toBlock, stepBlock);
            if (!segment1Data) {
                continue;
            }

            const segment2Data = getUnifiedDataForInterval(platform, pivot, toSymbol, fromBlock, toBlock, stepBlock);
            if (!segment2Data) {
                continue;
            }

            if (!pivotData[platform]) {
                pivotData[platform] = {};
            }

            if (!pivotData[platform][fromSymbol]) {
                pivotData[platform][fromSymbol] = {};
            }

            if (!pivotData[platform][pivot]) {
                pivotData[platform][pivot] = {};
            }

            pivotData[platform][fromSymbol][pivot] = segment1Data;
            pivotData[platform][pivot][toSymbol] = segment2Data;
        }
    }
    return pivotData;
}

module.exports = { getAverageLiquidityForInterval, getSlippageMapForInterval };