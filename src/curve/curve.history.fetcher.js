const { ethers, BigNumber } = require('ethers');
const dotenv = require('dotenv');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const { sleep } = require('../utils/utils');
const curvePoolABI = require('./curve.pool.abi.json');
const erc20ABI = require('./dai.erc20.abi.json');
const fs = require('fs');
dotenv.config();
const RPC_URL = process.env.RPC_URL;
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
const threePoolAddr = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7';


/// for (pool) returns [poolTokens]
async function getPoolTokens(pool) {
    const poolTokens = [];
    const contract = new ethers.Contract(pool, curvePoolABI, web3Provider);
    let inRange = true;
    let range = 0;

    while (inRange) {
        try {
            const token = await contract.coins(range);
            poolTokens.push(token);
            range += 1;

        }
        catch (error) {
            inRange = false;
        }
    }
    return poolTokens;
}

/// for (tokenAddress), (pooladdress) and [blockrange] returns historical data and blocklist
async function getTokenBalancesInRange(tokenAddress, poolAddress, blockRange) {
    const contract = new ethers.Contract(tokenAddress, erc20ABI, web3Provider);
    const startBlock = blockRange[0];
    const lastBlock = blockRange[1];
    const blockList = [];

    const results = {
        [tokenAddress]: {
            from: {},
            to: {}
        }
    };

    const filterFrom = contract.filters.Transfer(poolAddress);
    const filterTo = contract.filters.Transfer(null, poolAddress);

    const fromEvents = await contract.queryFilter(filterFrom, startBlock, lastBlock);

    const toEvents = await contract.queryFilter(filterTo, startBlock, lastBlock);

    for (let i = 0; i < fromEvents.length; i++) {
        results[tokenAddress]['from'][fromEvents[i].blockNumber] = fromEvents[i].args[2];
        if (!blockList.includes(fromEvents[i].blockNumber)) {
            blockList.push(fromEvents[i].blockNumber);
        }
    }
    for (let i = 0; i < toEvents.length; i++) {
        results[tokenAddress]['to'][toEvents[i].blockNumber] = toEvents[i].args[2];
        if (!blockList.includes(toEvents[i].blockNumber)) {
            blockList.push(toEvents[i].blockNumber);
        }
    }
    results['blockList'] = blockList;

    return results;
}

async function main() {
    if (!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }
    console.log('CURVE HistoryFetcher: starting');


    /// function variables
    const stepBlock = 5000;
    let poolAddress = threePoolAddr;
    let poolTokens = undefined;
    let startBlock = await GetContractCreationBlockNumber(web3Provider, poolAddress);
    const currentBlock = await web3Provider.getBlockNumber();

    /// Fetching tokens in pool
    console.log('--- fetching pool tokens ---');
    try {
        poolTokens = await getPoolTokens(poolAddress);
        console.log('Tokens found:', poolTokens.length);
        console.log('--- Pool tokens fetched ---');

    }
    catch (error) {
        console.log('Could not fetch tokens');
    }

    /// creating data file
    const historyFileName = `./src/data/${poolAddress}_curve.csv`;
    if (!fs.existsSync(historyFileName)) {
        let tokenHeaders = 'blocknumber';
        for (let i = 0; i < poolTokens.length; i++) {
            tokenHeaders += `,reserve_${poolTokens[i]}`;
        }
        fs.writeFileSync(historyFileName, `${tokenHeaders}\n`);
    }
    // //// If datafile exists, picking up where we left off
    // else {
    //     const fileContent = fs.readFileSync(historyFileName, 'utf-8').split('\n');
    //     const lastLine = fileContent[fileContent.length-2];
    //     startBlock = Number(lastLine.split(',')[0]) + 1;
    // }

    /// in the meantime:
    const historicalData = [];


    /// THIS IS WHERE STUFF HAPPENS, FROM START BLOCK TO END BLOCK
    for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += stepBlock) {
        const rangeData = [];
        const dataToWrite = [];
        let toBlock = fromBlock + stepBlock - 1; // add stepBlock -1 because the fromBlock counts in the number of block fetched
        if (toBlock > currentBlock) {
            toBlock = currentBlock;
        }
        console.log(`Fetching transfer events from block ${fromBlock} to block ${toBlock} `);
        ///Fetch each token events and store them in rangeData
        for (let i = 0; i < poolTokens.length; i++) {
            console.log(`token ${i + 1}/${poolTokens.length}: ${poolTokens[i]}`);
            const tokenData = await getTokenBalancesInRange(poolTokens[i], poolAddress, [fromBlock, toBlock])
                ;
            rangeData.push(tokenData);
        }
        ///Compute historical picture
        /////Compute block numbers from blockList(s)
        const concatenatedArrays = [];
        for (let y = 0; y < rangeData.length; y++) {
            for (let z = 0; z < rangeData[y]['blockList'].length; z++) {
                concatenatedArrays.push(rangeData[y]['blockList'][z]);
            }
        }
        let blockNumbersForRange = [... new Set(concatenatedArrays)];
        blockNumbersForRange = blockNumbersForRange.sort((a, b) => {
            return a - b;
        });

        /// Construct historical data for each blockNumbersForRange entry
        for (let block = 0; block < blockNumbersForRange.length; block++) {
            ///if there is no file, initialize variables
            if(historicalData.length === 0){
                const initialArray = [];
                initialArray.push(startBlock);
                for(let i = 0; i < poolTokens.length; i++){
                    initialArray.push(0);
                }
                dataToWrite.push(initialArray);
            }

            ///now take first block of blockNumberForRange and compute differences
            const currBlock = blockNumbersForRange[block];
            const arrayToPush = [];
            arrayToPush.push(currBlock);
            for(let j = 0; j < poolTokens.length; j++){
                const token = poolTokens[j];
                const tokenIndex = j + 1;
                /// old value
                const oldValue = BigNumber.from(dataToWrite[block][tokenIndex]);
                let delta = BigNumber.from('0');
                /// Compute new token value
                ////adding tokens going to the pool
                if(rangeData[j][token]['to'][currBlock]){
                    delta = delta.add(rangeData[j][token]['to'][currBlock]);
                }
                ////substracting tokens leaving the pool
                if(rangeData[j][token]['from'][currBlock]){
                    delta = delta.add(rangeData[j][token]['from'][currBlock]);
                }
                const newValue = oldValue.add(delta);
                //push to array
                arrayToPush.push(newValue.toString());
            }
            ///push array to data to be written
            dataToWrite.push(arrayToPush);
            console.log('dataToWrite', dataToWrite);
        }
        console.log('end');

    }

}
main();