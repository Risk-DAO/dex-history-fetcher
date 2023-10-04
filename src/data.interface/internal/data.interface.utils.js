
const path = require('path');
const fs = require('fs');
const { DATA_DIR, DEFAULT_STEP_BLOCK } = require('../../utils/constants');

/**
 * Gets the unified data from csv files
 * @param {string} platform
 * @param {string} fromSymbol
 * @param {string} toSymbol
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getUnifiedDataForInterval(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock= DEFAULT_STEP_BLOCK) {
    if(fromSymbol == 'stETH' && toSymbol == 'wstETH') {
        return specificUnifiedDataForIntervalForstETHwstETH(fromBlock, toBlock, stepBlock);
    }

    if(platform == 'curve') {
        return getUnifiedDataForIntervalForCurve(fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    }

    const filename = `${fromSymbol}-${toSymbol}-unified-data.csv`;
    const fullFilename = path.join(DATA_DIR, 'precomputed', platform, filename);

    return getUnifiedDataForIntervalByFilename(fullFilename, fromBlock, toBlock, stepBlock);
}



/**
 * Gets the unified data from csv files
 * @param {string} fullFilename
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getUnifiedDataForIntervalByFilename(fullFilename, fromBlock, toBlock, stepBlock= DEFAULT_STEP_BLOCK) {
    // try to find the data
    if(!fs.existsSync(fullFilename)) {
        console.log(`Could not find file ${fullFilename}`);
        return undefined;
    }

    // console.log(`${fnName()}: ${fullFilename} found! Extracting data since ${fromBlock} to ${toBlock}`);

    const fileContent = fs.readFileSync(fullFilename, 'utf-8').split('\n');
    const unifiedData = getBlankUnifiedData(fromBlock, toBlock, stepBlock);
    const blocksToFill = Object.keys(unifiedData).map(_ => Number(_));
    let currentIndexToFill = 0;

    for(let i = 1; i < fileContent.length - 1; i++) {
        const blockNumber = Number(fileContent[i].split(',')[0]);
        if(blockNumber > toBlock) {
            break;
        }
        let nextBlockNumber = Number(fileContent[i+1].split(',')[0]);

        // on the last line, consider the nextBlockNumber to be the toBlock + 1
        // this will fill the unifiedData dictionary up until the toBlock with the last data we
        // have in the csv file
        if(i == fileContent.length -2) {
            nextBlockNumber = toBlock + 1;
        }
        let blockToFill = blocksToFill[currentIndexToFill];

        if(nextBlockNumber > blockToFill) {
            const data = extractDataFromUnifiedLine(fileContent[i]);

            while(nextBlockNumber > blockToFill) {
                unifiedData[blockToFill] = {
                    price: data.price,
                    slippageMap: structuredClone(data.slippageMap)
                };
                currentIndexToFill++;
                blockToFill = blocksToFill[currentIndexToFill];

                if(currentIndexToFill >= blocksToFill.length) {
                    break;
                }
            }
        }
    }

    if(currentIndexToFill == 0) {
        console.log(`Could not find data in file ${fullFilename} since block ${fromBlock}`);
        const latestData = extractDataFromUnifiedLine(fileContent[fileContent.length-2]);
        if(latestData.blockNumber < fromBlock) {
            console.log(`Will use latest data at block ${latestData.blockNumber} to fill unified data`);
            for(const blockNumber of blocksToFill) {
                unifiedData[blockNumber] = {
                    price: latestData.price,
                    slippageMap: structuredClone(latestData.slippageMap)
                };
            }

            return unifiedData;
        } else {
            console.log(`Could not find any blocks before ${fromBlock} in file ${fullFilename}`);
            return undefined;
        }
    }

    // if exited before filling every blocks, add last value to all remaining
    // I THINK THIS IS USELESS
    const lastFilledIndex = currentIndexToFill-1;
    while(currentIndexToFill < blocksToFill.length) {
        unifiedData[blocksToFill[currentIndexToFill]] = {
            price: structuredClone(unifiedData[blocksToFill[lastFilledIndex]].price),
            slippageMap: structuredClone(unifiedData[blocksToFill[lastFilledIndex]].slippageMap)
        };
        currentIndexToFill++;
    }

    return unifiedData;
}

/**
 * specific case for stETH/wstETH = always return infinite liquidity
 * with price taken from uniswapv3 WETH/wstETH pair
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @param {number} stepBlock 
 */
function specificUnifiedDataForIntervalForstETHwstETH(fromBlock, toBlock, stepBlock= DEFAULT_STEP_BLOCK) {
    const filename = 'WETH-wstETH-unified-data.csv';
    const fullFilename = path.join(DATA_DIR, 'precomputed', 'uniswapv3', filename);

    const unifiedData = getUnifiedDataForIntervalByFilename(fullFilename, fromBlock, toBlock, stepBlock);

    for(const data of Object.values(unifiedData)) {
        for(const slippageBps of Object.keys(data.slippageMap)) {
            data.slippageMap[slippageBps] = 1e12;
        }
    }

    return unifiedData;
}


function getUnifiedDataForIntervalForCurve(fromSymbol, toSymbol, fromBlock, toBlock, stepBlock= DEFAULT_STEP_BLOCK) {
    // for curve, find all files in the precomputed/curve directory that math the fromSymbol-toSymbol.*.csv
    const searchString = `${fromSymbol}-${toSymbol}`;
    const directory = path.join(DATA_DIR, 'precomputed', 'curve');
    const matchingFiles = fs.readdirSync(directory).filter(_ => _.startsWith(searchString) && _.endsWith('.csv'));
    console.log(`found ${matchingFiles.length} matching files for ${searchString}`);

    const unifiedDataForPools = [];
    for(const matchingFile of matchingFiles) {
        const fullFilename = path.join(directory, matchingFile);
        const unifiedDataForFile = getUnifiedDataForIntervalByFilename(fullFilename, fromBlock, toBlock, stepBlock);
        if(unifiedDataForFile) {
            console.log(`adding unified data from file ${matchingFile} to unifiedDataArray`);
            unifiedDataForPools.push(unifiedDataForFile);
        }
    }

    if(unifiedDataForPools.length == 0) {
        return undefined;
    }

    const unifiedData = unifiedDataForPools[0];
    
    for(const block of Object.keys(unifiedData)) {
        for(let i = 1; i < unifiedDataForPools.length; i++) {
            const unifiedDataToAdd = unifiedDataForPools[i];
    
            for(const slippageBps of Object.keys(unifiedData[block].slippageMap)) {
                unifiedData[block].slippageMap[slippageBps] += unifiedDataToAdd[block].slippageMap[slippageBps];
            }

            unifiedData[block].price += unifiedDataToAdd[block].price;
        }
        
        // save avg price for each pools
        unifiedData[block].price =  unifiedData[block].price / unifiedDataForPools.length;
    }

    return unifiedData;
}
/**
 * This function returns an object preinstanciated with all the blocks that will need to be filled
 * @param {number} startBlock 
 * @param {number} endBlock 
 * @param {number} stepBlock amount of blocks between two steps, default to 50
 * @returns {{[blocknumber: number]: {}}}
 */
function getBlankUnifiedData(startBlock, endBlock, stepBlock= DEFAULT_STEP_BLOCK) {
    if(stepBlock < 50) {
        console.log(`getBlankUnifiedData: cannot use stepBlock= ${stepBlock}, min value is 50`);
        stepBlock = 50;
    }
    const unifiedData = {};
    let currentBlock = startBlock;
    while(currentBlock <= endBlock) {
        unifiedData[currentBlock] = {};
        currentBlock += stepBlock;
    }

    return unifiedData;
}

function extractDataFromUnifiedLine(line) {
    const splt = line.split(',');
    const blockNumber = splt[0];
    const price = splt[1];
    const slippageMapJson = line.replace(`${blockNumber},${price},`, '');
    const slippageMap = JSON.parse(slippageMapJson);

    return {
        blockNumber: Number(blockNumber),
        price: Number(price),
        slippageMap: slippageMap
    };
}

module.exports = { getUnifiedDataForInterval, getBlankUnifiedData };