
const path = require('path');
const fs = require('fs');
const DATA_DIR = process.cwd() + '/data';

/**
 * Get unified data for each target platforms
 * @param {string[]} platforms 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{[platform: string]: {[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getUnifiedDataForPlatforms(platforms, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock=50) {
    const data = {};
    for (const platform of platforms) {
        const unifiedData = getUnifiedDataForInterval(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
        if (!unifiedData) {
            console.log(`getUnifiedDataForPlatforms for ${fromSymbol}/${toSymbol}: could not find data on platform ${platform}`);
        } else {
            data[platform] = unifiedData;
        }
    }
    return data;
}

/**
 * Gets the unified data from csv files
 * @param {string} platform 
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getUnifiedDataForInterval(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock=50) {
    // try to find the data
    const filename = `${fromSymbol}-${toSymbol}-unified-data.csv`;
    const fullFilename = path.join(DATA_DIR, 'precomputed', platform, filename);
    // console.log(`${fnName()}: searching file ${fullFilename}`);
    if(!fs.existsSync(fullFilename)) {
        console.log(`Could not find file ${fullFilename}`);
        return undefined;
    }

    // console.log(`${fnName()}: ${fullFilename} found! Extracting data since ${fromBlock} to ${toBlock}`);

    const fileContent = fs.readFileSync(fullFilename, 'utf-8').split('\n');
    const unifiedData = getBlankUnifiedData(fromBlock, toBlock, stepBlock);
    const blocksToFill = Object.keys(unifiedData).map(_ => Number(_));
    let currentIndexToFill = 0;

    for(let i = 1; i < fileContent.length - 2; i++) {
        const blockNumber = Number(fileContent[i].split(',')[0]);

        if(blockNumber > toBlock) {
            break;
        }
        const nextBlockNumber = Number(fileContent[i+1].split(',')[0]);

        if(nextBlockNumber > blocksToFill[currentIndexToFill]) {
            const data = extractDataFromUnifiedLine(fileContent[i]);

            while(nextBlockNumber > blocksToFill[currentIndexToFill]) {
                unifiedData[blocksToFill[currentIndexToFill]] = {
                    price: data.price,
                    slippageMap: data.slippageMap
                };
                currentIndexToFill++;
                if(currentIndexToFill >= blocksToFill.length) {
                    break;
                }
            }
        }
    }

    // if currentIndexToFill == 0, it means that no data was found, return empty
    if(currentIndexToFill == 0) {
        console.log(`Could not find data in file ${fullFilename} since block ${fromBlock}`);
        const latestData = extractDataFromUnifiedLine(fileContent[fileContent.length-2]);
        if(latestData.blockNumber < fromBlock) {
            console.log(`Will use latest data at block ${latestData.blockNumber} to fill unified data`);
            for(const blockNumber of blocksToFill) {
                unifiedData[blockNumber] = {
                    price: latestData.price,
                    slippageMap: latestData.slippageMap
                };
            }

            return unifiedData;
        } else {
            console.log(`Could not find any blocks before ${fromBlock} in file ${fullFilename}`);
            return undefined;
        }
    }
    // if exited before filling every blocks, add last value to all remaining
    const lastFilledIndex = currentIndexToFill-1;
    while(currentIndexToFill < blocksToFill.length) {
        unifiedData[blocksToFill[currentIndexToFill]] = {
            price: unifiedData[blocksToFill[lastFilledIndex]].price,
            slippageMap: unifiedData[blocksToFill[lastFilledIndex]].slippageMap
        };
        currentIndexToFill++;
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
function getBlankUnifiedData(startBlock, endBlock, stepBlock=50) {
    if(stepBlock < 50) {
        console.log(`getBlankUnifiedData: cannot use stepBlock= ${stepBlock}, min value is 50`);
        stepBlock = 50;
    }
    const unifiedData = {};
    let currentBlock = startBlock;
    while(currentBlock < endBlock) {
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

module.exports = { getUnifiedDataForInterval, getUnifiedDataForPlatforms };