const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { ethers } = require('ethers');
const { precomputeUniswapV2Data } = require('./uniswap.v2.precomputer');
const { sleep, fnName } = require('../utils/utils');

const RPC_URL = process.env.RPC_URL;
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
const TARGET_DATA_POINTS = Number(process.env.TARGET_DATA_POINTS || 50);
const TARGET_SLIPPAGES = [1, 5, 10, 15, 20];


async function main() {
    // eslint-disable-next-line no-constant-condition
    while(true) {
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

        console.log(`${fnName()}: Will precompute data for the last ${daysToFetch} day(s)`);

        const startDate = Math.round(Date.now()/1000) - daysToFetch * 24 * 60 * 60;
        // get the blocknumber for this date
        const startBlock =  await getBlocknumberForTimestamp(startDate);
        const currentBlock = await web3Provider.getBlockNumber();

        // calculate block step considering we want TARGET_DATA_POINTS
        const blockStep = Math.round((currentBlock - startBlock) / TARGET_DATA_POINTS);
        console.log(`${fnName()}: Will precompute data since block ${startBlock} to ${currentBlock} with step: ${blockStep} blocks`);
        
        // creating blockrange
        const blockRange = [];
        for (let i = startBlock; i <= currentBlock; i+= blockStep) {
            blockRange.push(i);
        }
        // console.log(blockRange);


        await precomputeUniswapV2Data(blockRange, TARGET_SLIPPAGES, daysToFetch);
        
        console.log(`${fnName()}: sleeping ${fetchEveryMinutes} minutes before starting again`);
        await sleep(fetchEveryMinutes * 60 * 1000);
    }
}

main();