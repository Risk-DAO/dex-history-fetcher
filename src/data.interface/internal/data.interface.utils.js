
const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('../../utils/constants');

/**
 * Get unified data for a target platform
 * @param {string} platform
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{[platform: string]: {[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getUnifiedDataForPlatform(platform, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock=50) {
    let unifiedData = undefined;
    if(platform == 'curve') {
        // specific case for curve, we have to sum all the unified file for the fromSymbol/toSymbol
        // because there are many pools
        unifiedData = getUnifiedDataForIntervalForCurve(fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    } else {
        const filename = `${fromSymbol}-${toSymbol}-unified-data.csv`;
        const fullFilename = path.join(DATA_DIR, 'precomputed', platform, filename);
    
        unifiedData = getUnifiedDataForInterval(fullFilename, fromSymbol, toSymbol, fromBlock, toBlock, stepBlock);
    }
    if (!unifiedData) {
        console.log(`getUnifiedDataForPlatforms for ${fromSymbol}/${toSymbol}: could not find data on platform ${platform}`);
    }
    return unifiedData;
}

function getUnifiedDataForIntervalForCurve(fromSymbol, toSymbol, fromBlock, toBlock, stepBlock) {

    // for curve, find all files in the precomputed/curve directory that math the fromSymbol-toSymbol.*.csv
    const searchString = `${fromSymbol}-${toSymbol}`;
    const directory = path.join(DATA_DIR, 'precomputed', 'curve');
    const matchingFiles = fs.readdirSync(directory).filter(_ => _.startsWith(searchString) && _.endsWith('.csv'));
    console.log(`found ${matchingFiles.length} matching files for ${searchString}`);

    const unifiedDataForPools = [];
    for(const matchingFile of matchingFiles) {
        const fullFilename = path.join(directory, matchingFile);
        const unifiedDataForFile = getUnifiedDataForInterval(fullFilename, fromBlock, toBlock, stepBlock);
        if(unifiedDataForFile) {
            console.log(`adding unified data from file ${matchingFile} to unifiedDataArray`);
            unifiedDataForPools.push(unifiedDataForFile);
        }
    }

    if(unifiedDataForPools.length == 0) {
        return undefined;
    }

    for(const unified of unifiedDataForPools) {
        const lastBlock = Object.keys(unified).at(-1);
        console.log(`${unified[lastBlock].slippageMap[50]}`);
    }

    const unifiedData = unifiedDataForPools[0];
    
    for(const block of Object.keys(unifiedData)) {
        for(let i = 1; i < unifiedDataForPools.length; i++) {
            const unifiedDataToAdd = unifiedDataForPools[i];
    
            for(const slippageBps of Object.keys(unifiedData[block].slippageMap)) {
                // console.log(`${block} ${slippageBps} old data: ${unifiedData[block].slippageMap[slippageBps]}`);
                // console.log(`${block} ${slippageBps} adding ${unifiedDataToAdd[block].slippageMap[slippageBps]}`);
                unifiedData[block].slippageMap[slippageBps] += unifiedDataToAdd[block].slippageMap[slippageBps];
                // console.log(`${block} ${slippageBps} new data: ${unifiedData[block].slippageMap[slippageBps]}`);
            }

            unifiedData[block].price += unifiedDataToAdd[block].price;
        }
        
        // save avg price for each pools
        unifiedData[block].price =  unifiedData[block].price / unifiedDataForPools.length;
    }

    return unifiedData;
}

/**
 * Gets the unified data from csv files
 * @param {string} fullFilename
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {{[blocknumber: number]: {price: number, slippageMap: {[slippageBps: number]: number}}}}
 */
function getUnifiedDataForInterval(fullFilename, fromBlock, toBlock, stepBlock=50) {
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

module.exports = { getUnifiedDataForInterval, getUnifiedDataForPlatform, getBlankUnifiedData };