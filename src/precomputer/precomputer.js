const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { ethers } = require('ethers');
const { precomputeUniswapV2Data } = require('./uniswap.v2.precomputer');
const { sleep, fnName, roundTo } = require('../utils/utils');
const { precomputeUniswapV3Data } = require('./uniswap.v3.precomputer');
const { precomputeCurveData } = require('./curve.precomputer');
const path = require('path');
const fs = require('fs');

const RPC_URL = process.env.RPC_URL;
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
const TARGET_DATA_POINTS = Number(process.env.TARGET_DATA_POINTS || 50);
const TARGET_SLIPPAGES = [1, 5, 10, 15, 20];
const PRECOMPUTED_DIRS = ['uniswapv2', 'curve', 'uniswapv3'];
const DATA_DIR = process.cwd() + '/data';


/**
 * Precompute data for the risk oracle front
 * @param {number} daysToFetch 
 * @param {number} fetchEveryMinutes 
 */
async function precomputeData(daysToFetch, fetchEveryMinutes) {
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const start = Date.now();
        console.log(`${fnName()}: Will precompute data for the last ${daysToFetch} day(s)`);

        const startDate = Math.round(Date.now()/1000) - daysToFetch * 24 * 60 * 60;
        // get the blocknumber for this date
        const startBlock =  await getBlocknumberForTimestamp(startDate);
        const currentBlock = await web3Provider.getBlockNumber() - 150;

        // calculate block step considering we want TARGET_DATA_POINTS
        const blockStep = Math.round((currentBlock - startBlock) / TARGET_DATA_POINTS);
        console.log(`${fnName()}: Will precompute data since block ${startBlock} to ${currentBlock} with step: ${blockStep} blocks`);
        
        // creating blockrange
        const blockRange = [];
        for (let i = 0; i < TARGET_DATA_POINTS; i++) {
            const block = startBlock + i*blockStep;
            if(block > currentBlock) {
                break;
            }

            blockRange.push(startBlock + i*blockStep);
        }
        
        // console.log(blockRange);
        
        await precomputeUniswapV2Data(blockRange, TARGET_SLIPPAGES, daysToFetch);
        await precomputeCurveData(blockRange, TARGET_SLIPPAGES, daysToFetch);
        await precomputeUniswapV3Data(blockRange, TARGET_SLIPPAGES, daysToFetch);


        // delete old files and replace with new one
        // this ensure that the new files are all generated at the same time
        // without this, the precomputed values for univ2 would be generated much faster than the curve ones
        // and that would mean that if the API was to be called at between the update time of univ2 and curve files
        // then the values of the both files would not share the same block numbers
        for(const precomputedSubDir of PRECOMPUTED_DIRS) {
            const concatenatedFilename = path.join(DATA_DIR, 'precomputed', precomputedSubDir, `concat-${daysToFetch}d.json`);
            const concatenatedFilenameStaging = path.join(DATA_DIR, 'precomputed', precomputedSubDir, `concat-${daysToFetch}d.json-staging`);
            
            if(fs.existsSync(concatenatedFilename)) {
                console.log(`${fnName()}: deleting ${concatenatedFilename}`);
                fs.rmSync(concatenatedFilename);
            }

            console.log(`${fnName()}: moving ${concatenatedFilenameStaging} to ${concatenatedFilename}`);
            fs.renameSync(concatenatedFilenameStaging, concatenatedFilename);
        }
        
        const sleepTime = fetchEveryMinutes * 60 * 1000 - (Date.now() - start);
        if(sleepTime > 0) {
            console.log(`${fnName()}: sleeping ${roundTo(sleepTime/1000/60)} minutes`);
            await sleep(sleepTime);
        }
    }
}

async function main() {
    // number of days to fetch is passed in the args
    const daysToFetch = Number(process.argv[2]);
    if(!daysToFetch) {
        throw new Error('Need to have a valid number as first command argument for daysToFetch');
    }

    // number of days to fetch is passed in the args
    const fetchEveryMinutes = Number(process.argv[3]);
    if(!fetchEveryMinutes) {
        throw new Error('Need to have a valid number as second command argument for fetchEveryMinutes');
    }

    await precomputeData(daysToFetch, fetchEveryMinutes);
}

main();