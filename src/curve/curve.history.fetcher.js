const { ethers, BigNumber } = require('ethers');
const dotenv = require('dotenv');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const { sleep } = require('../utils/utils');
const curvePoolABI = require('./curve.pool.abi.json');
const erc20ABI = require('./dai.erc20.abi.json');
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

/// for (tokenAddress), (pooladdress) and [blockrange] returns [{from: block:balance},{to: block:balance}]
async function getTokenBalancesInRange(tokenAddress, poolAddress, blockRange){
    const contract = new ethers.Contract(tokenAddress, erc20ABI, web3Provider);
    const startBlock = blockRange[0];
    const lastBlock = blockRange[1];

    const results = [];
    results[0] = {from: {}};
    results[1] = {to: {}};


    const filterFrom = contract.filters.Transfer(poolAddress);
    const filterTo = contract.filters.Transfer(null, poolAddress);

    const fromEvents = await contract.queryFilter(filterFrom, startBlock, lastBlock);
    
    const toEvents = await contract.queryFilter(filterTo, startBlock, lastBlock);

    for(let i = 0; i < fromEvents.length; i++){
        results[0].from[fromEvents[i].blockNumber] = fromEvents[i].args[2];
    }
    for(let i = 0; i < toEvents.length; i++){
        results[1].from[toEvents[i].blockNumber] = toEvents[i].args[2];
    }
    return results;
}

async function GetBalances(block) {
    const results = [];
    const p = '0x' + '1'.padStart(64, '0');
    const pKeccak = ethers.utils.keccak256(p);

    const bnPKeccak = BigNumber.from(pKeccak);
    console.log(bnPKeccak.toString());
    for (let i = 0; i < 3; i++) {
        const r = await web3Provider.getStorageAt(threePoolAddr, bnPKeccak.add(i), block);
        const b = BigNumber.from(r);
        results.push(b.toString());
    }
    return results;
}

async function FetchHistoryForPool(historyFileName) {
    const currentBlock = await web3Provider.getBlockNumber();
    const initStepBlock = 5000;
    let stepBlock = initStepBlock;
    let startBlock = await GetContractCreationBlockNumber(web3Provider, threePoolAddr);
    let lastBlock = undefined;
    let topics = [];
    let historicalData = [];


    for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += stepBlock) {
        let toBlock = fromBlock + stepBlock - 1;
        if (toBlock > currentBlock) {
            toBlock = currentBlock;
        }
        let events;
        try {
            console.log(`FetchHistoryForPool: start fetching data for ${currentBlock - startBlock} blocks to reach current block: ${currentBlock}`);
            events = await web3Provider.getLogs({
                address: threePoolAddr,
                fromBlock: fromBlock,
                toBlock: toBlock
            });
        }
        catch (error) {
            fromBlock -= stepBlock;
            stepBlock = stepBlock / 2;
            console.log(`Exception: ${error.message}, will retry with new step: ${stepBlock}`);
            await sleep(5000);
            continue;
        }
        for (let i = 0; i < events.length; i++) {
            historicalData.push({
                block: events[i].blockNumber,
                balances: await GetBalances(events[i].blockNumber)
            });
        }
    }

    /// getting the logs



}



async function main() {
    let poolTokens = undefined;
    if (!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }
    console.log('CURVE HistoryFetcher: starting');
    console.log('--- fetching pool tokens ---');
    try {
        poolTokens = await getPoolTokens(threePoolAddr);
        console.log('PoolTokens', poolTokens);
        console.log('--- Pool tokens fetched ---');
        
    }
    catch (error) {
        console.log('Could not fetch tokens');
    }


}

getTokenBalancesInRange('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', threePoolAddr, [16490137, 16491137]);