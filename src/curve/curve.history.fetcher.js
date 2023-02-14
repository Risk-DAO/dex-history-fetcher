const { ethers, BigNumber } = require('ethers');
const dotenv = require('dotenv');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const curvePoolABI = require('./ABIs/curve.pool.abi.json');
const susdABI = require('./ABIs/susd.curve.pool.abi.json');
const erc20ABI = require('./ABIs/dai.erc20.abi.json');
const curveConfig = require('./curve.config');
const fs = require('fs');
dotenv.config();
const RPC_URL = process.env.RPC_URL;
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);

//Getting rampA events
/**
 * for(pool, fromBlock, toBlock) returns {results}
 * @param {string} pool 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns 
 */
async function fetchRampA(pool, fromBlock, toBlock) {
    const results = {};
    const poolContract = new ethers.Contract(pool, curvePoolABI, web3Provider);
    let events = await poolContract.queryFilter('RampA',fromBlock, toBlock);
    for(let i = 0; i < events.length; i++){
        results[events[i].blockNumber] = events[i].args['new_A'].toString();
    }
    return results; 
}


/**
 * for (pool) returns [poolTokens]
 * @param {{poolAddress: string, poolName: string, version: number, abi: string, ampFactor: number}} pool 
 * @returns [poolTokens]
 */
async function getPoolTokens(pool) {
    const poolTokens = [];
    let contract = undefined;
    if (pool['abi'] === 'susdABI') {
        contract = new ethers.Contract(pool['poolAddress'], susdABI, web3Provider);
    }
    else if (pool['abi'] === 'erc20ABI') {
        contract = new ethers.Contract(pool['poolAddress'], curvePoolABI, web3Provider);
    }
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


/**
 * for (tokenAddress), (pooladdress) and [blockrange] returns historical data and blocklist
 * @param {string} tokenAddress 
 * @param {string} poolAddress 
 * @param {[number, number]} blockRange 
 * @returns []
 */
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
        if (!results[tokenAddress]['from'][fromEvents[i].blockNumber]) {
            results[tokenAddress]['from'][fromEvents[i].blockNumber] = BigNumber.from(0);
        }
        results[tokenAddress]['from'][fromEvents[i].blockNumber] = results[tokenAddress]['from'][fromEvents[i].blockNumber].add(BigNumber.from(fromEvents[i].args[2]));
        if (!blockList.includes(fromEvents[i].blockNumber)) {
            blockList.push(fromEvents[i].blockNumber);
        }
    }
    for (let i = 0; i < toEvents.length; i++) {
        if (!results[tokenAddress]['to'][toEvents[i].blockNumber]) {
            results[tokenAddress]['to'][toEvents[i].blockNumber] = BigNumber.from(0);
        }
        results[tokenAddress]['to'][toEvents[i].blockNumber] = results[tokenAddress]['to'][toEvents[i].blockNumber].add(BigNumber.from(toEvents[i].args[2]));
        if (!blockList.includes(toEvents[i].blockNumber)) {
            blockList.push(toEvents[i].blockNumber);
        }
    }
    results['blockList'] = blockList;

    return results;
}

/**
 * takes [poolTokens], poolAddress, fromBlock and toBlock and returns events for given blocks
 * @param {string[]} poolTokens 
 * @param {string} poolAddress 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns 
 */
async function fetchBlocks(poolTokens, poolAddress, fromBlock, toBlock) {
    const results = [];
    for (let i = 0; i < poolTokens.length; i++) {
        console.log(`token ${i + 1}/${poolTokens.length}`);
        const tokenData = await getTokenBalancesInRange(poolTokens[i], poolAddress, [fromBlock, toBlock])
            ;
        results.push(tokenData);
    }
    return results;
}

/**
 * takes token events and ampfactors events and return consolidated blocklist
 * @param {{[key: string]: {to:{[blocknumber: number]: BigNumber}, from:{[blocknumber: number]: BigNumber}, blocklist: number[]}} rangeData 
 * @param {{number: number}} ampFactors 
 * @returns 
 */
function blockList(rangeData, ampFactors) {
    const concatenatedArrays = [];
    for (let y = 0; y < rangeData.length; y++) {
        for (let z = 0; z < rangeData[y]['blockList'].length; z++) {
            concatenatedArrays.push(rangeData[y]['blockList'][z]);
        }
    }
    for(const element in ampFactors){
        concatenatedArrays.push(element);
    }
    let blockNumbersForRange = [... new Set(concatenatedArrays)];
    blockNumbersForRange = blockNumbersForRange.sort((a, b) => {
        return a - b;
    });
    return blockNumbersForRange;
}

/**
 * Takes a pool from curve.config.js and outputs liquidity file in /data
 * @param {{poolAddress: string, poolName: string, version: number, abi: string, ampFactor: number}} pool 
 */
async function FetchHistory(pool) {
    if (!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }
    console.log('-------------------------------');
    console.log('CURVE HistoryFetcher: starting on pool', pool['poolName']);


    /// function variables
    let poolAddress = pool['poolAddress'];
    const historyFileName = `./src/data/${pool['poolName']}_${poolAddress}_curve.csv`;
    const stepBlock = 20000;
    let poolTokens = undefined;
    let poolSymbols = [];
    let startBlock = undefined;
    const currentBlock = await web3Provider.getBlockNumber();
    let lastBlockData = [];
    let currentAmpFactor = pool.ampFactor;

    /// Fetching tokens in pool
    console.log('--- fetching pool tokens ---');
    try {
        poolTokens = await getPoolTokens(pool);
        console.log('Tokens found:', poolTokens.length);
        for (let i = 0; i < poolTokens.length; i++) {
            const contractForSymbol = new ethers.Contract(poolTokens[i], erc20ABI, web3Provider);
            const tokenSymbol = await contractForSymbol.symbol();
            poolSymbols.push(tokenSymbol);
        }
        for (let i = 0; i < poolSymbols.length; i++) {
            console.log(poolSymbols[i]);
        }
        console.log('--- Pool tokens fetched ---');

    }
    catch (error) {
        console.log('Could not fetch token symbol');
    }
    ///if file exists, taking start block and last block data from file
    if (fs.existsSync(historyFileName)) {
        const fileContent = fs.readFileSync(historyFileName, 'utf-8').split('\n');
        const lastLine = fileContent[fileContent.length - 2];
        lastBlockData = lastLine.split(',');
        startBlock = Number(lastBlockData[0]) + 1;
        currentAmpFactor = lastBlockData[1];
        console.log('startblock from file is:', startBlock);
    }
    else {
        startBlock = await GetContractCreationBlockNumber(web3Provider, poolAddress);
        console.log('startblock from contract is:', startBlock);
        const initialArray = [];
        initialArray.push(startBlock);
        let tokenHeaders = 'blocknumber, ampfactor';
        initialArray.push(pool.ampFactor);
        for (let i = 0; i < poolTokens.length; i++) {
            initialArray.push('0');
            tokenHeaders += `,reserve_${poolSymbols[i]}_${poolTokens[i]}`;
        }
        lastBlockData = initialArray;
        fs.writeFileSync(historyFileName, `${tokenHeaders}\n${initialArray}\n`);
    }


    /// THIS IS WHERE STUFF HAPPENS, FROM START BLOCK TO END BLOCK
    for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += stepBlock) {
        let dataToWrite = [];
        dataToWrite.push(lastBlockData);
        let toBlock = fromBlock + stepBlock - 1; // add stepBlock -1 because the fromBlock counts in the number of block fetched
        if (toBlock > currentBlock) {
            toBlock = currentBlock;
        }
        console.log(`Fetching transfer events from block ${fromBlock} to block ${toBlock} -- blocks to go ${currentBlock - toBlock} -- calls to go ${Math.ceil((currentBlock - toBlock) / stepBlock)} `);
        ///Fetch each token events and store them in rangeData
        const rangeData = await fetchBlocks(poolTokens, poolAddress, fromBlock, toBlock);
        /// fetch amp factors modifications
        const ampFactors = await fetchRampA(poolAddress, fromBlock, toBlock);
        /////Compute block numbers from blockList(s)
        const blockNumbersForRange = blockList(rangeData, ampFactors);
        /// Construct historical data for each blockNumbersForRange entry
        for (let block = 0; block < blockNumbersForRange.length; block++) {
            ///Take first block of blockNumberForRange and compute differences
            const currBlock = blockNumbersForRange[block];
            const arrayToPush = [];
            arrayToPush.push(currBlock);
            if(currBlock in ampFactors){
                arrayToPush.push(ampFactors[currBlock]);
                currentAmpFactor = ampFactors[currBlock];
            }
            else{
                arrayToPush.push(currentAmpFactor);
            }
            for (let j = 0; j < poolTokens.length; j++) {
                const token = poolTokens[j];
                const tokenIndex = j + 2;
                if (token === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' || (token === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' && pool['wethIsEth'] === true)) {
                    const value = await web3Provider.getBalance(pool['poolAddress'], currBlock);
                    arrayToPush.push(value.toString());
                }
                else {
                    /// old value
                    const oldValue = BigNumber.from(dataToWrite[block][tokenIndex]);
                    let delta = BigNumber.from('0');
                    /// Compute new token value
                    ////adding tokens going to the pool
                    if (rangeData[j][token]['to'][currBlock]) {
                        delta = delta.add(rangeData[j][token]['to'][currBlock]);
                    }
                    ////substracting tokens leaving the pool
                    if (rangeData[j][token]['from'][currBlock]) {
                        delta = delta.sub(rangeData[j][token]['from'][currBlock]);
                    }
                    const newValue = oldValue.add(delta);
                    //push to array
                    arrayToPush.push(newValue.toString());
                }
            }
            ///push array to data to be written
            dataToWrite.push(arrayToPush);

        }
        lastBlockData = dataToWrite.at(-1);
        const writing = dataToWrite.slice(1);
        if (writing.length !== 0) {
            fs.appendFileSync(historyFileName, writing.join('\n') + '\n');
        }
    }
    console.log('CURVE HistoryFetcher: reached last block:', currentBlock);
    console.log('CURVE HistoryFetcher: end');
    console.log('-------------------------------');
}

module.exports = { FetchHistory };