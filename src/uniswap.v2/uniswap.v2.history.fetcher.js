const { ethers } = require('ethers');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const univ2Config = require('./uniswap.v2.config');
const { tokens } = require('../global.config');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const { sleep, fnName } = require('../utils/utils');

const RPC_URL = process.env.RPC_URL;
const DATA_DIR = process.cwd() + '/data';
const MINIMUM_TO_APPEND = process.env.MINIMUM_TO_APPEND || 5000;

/**
 * Fetch all liquidity history from UniswapV2 pairs
 * The pairs to fetch are read from the config file './uniswap.v2.config'
 */
async function UniswapV2HistoryFetcher() {
    // eslint-disable-next-line no-constant-condition
    while(true) {
        if(!RPC_URL) {
            throw new Error('Could not find RPC_URL env variable');
        }
        
        if(!fs.existsSync(`${DATA_DIR}/uniswapv2`)) {
            fs.mkdirSync(`${DATA_DIR}/uniswapv2`);
        }

        console.log('UniswapV2HistoryFetcher: starting');
        const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);

        for(const pairKey of univ2Config.uniswapV2Pairs) {
            console.log('Start fetching pair ' + pairKey);
            await FetchHistoryForPair(web3Provider, pairKey, `${DATA_DIR}/uniswapv2/${pairKey}_uniswapv2.csv`);
            console.log('End fetching pair ' + pairKey);
        }

        console.log('UniswapV2HistoryFetcher: ending');
        
        await sleep(1000 * 600);
    }
}

/**
 * Fetches all history for a uniswap v2 pair (a pool)
 * Store the results into a csv file, and use the file as start for a run
 * if the file does not exists, create it and start at the contract deploy block
 * if the file exists, start at the last block fetched + 1
 * @param {ethers.providers.BaseProvider} web3Provider 
 * @param {string} pairKey
 */
async function FetchHistoryForPair(web3Provider, pairKey, historyFileName) {
    const token0Symbol = pairKey.split('-')[0];
    const token0Address = tokens[token0Symbol].address;
    const token1Symbol = pairKey.split('-')[1];
    const token1Address = tokens[token1Symbol].address;
    const factoryContract = new ethers.Contract(univ2Config.uniswapV2FactoryAddress, univ2Config.uniswapV2FactoryABI, web3Provider);
    const pairAddress = await factoryContract.getPair(token0Address, token1Address);

    if(pairAddress == ethers.constants.AddressZero) {
        throw new Error(`Could not find address with tokens  ${token0Symbol} and ${token1Symbol}`);
    }

    const pairContract = new ethers.Contract(pairAddress, univ2Config.uniswapV2PairABI, web3Provider);
    const contractToken0 = await pairContract.token0();
    if(contractToken0.toLowerCase() != token0Address.toLowerCase()) {
        throw new Error('Order mismatch between configuration and uniswapv2 pair');
    }
    const contractToken1 = await pairContract.token1();
    if(contractToken1.toLowerCase() != token1Address.toLowerCase()) {
        throw new Error('Order mismatch between configuration and uniswapv2 pair');
    }
    const currentBlock = await web3Provider.getBlockNumber();

    const initBlockStep = 10000;

    let startBlock = undefined;
    if (!fs.existsSync(DATA_DIR)){
        fs.mkdirSync(DATA_DIR);
    }
    if(!fs.existsSync(historyFileName)) {
        fs.writeFileSync(historyFileName, `blocknumber,reserve_${token0Symbol}_${token0Address},reserve_${token1Symbol}_${token1Address}\n`);
    } else {
        const fileContent = fs.readFileSync(historyFileName, 'utf-8').split('\n');
        const lastLine = fileContent[fileContent.length-2];
        startBlock = Number(lastLine.split(',')[0]) + 1;
    }
    
    if(!startBlock) {
        const deployBlockNumber = await GetContractCreationBlockNumber(web3Provider, pairAddress);
        startBlock = deployBlockNumber;
    }

    console.log(`FetchHistoryForPair[${pairKey}]: start fetching data for ${currentBlock - startBlock} blocks to reach current block: ${currentBlock}`);

    let liquidityValues = [];

    let blockStep = initBlockStep;
    let fromBlock =  startBlock;
    let toBlock = 0;
    let cptError = 0;
    while(toBlock < currentBlock) {

        toBlock = fromBlock + blockStep - 1;
        if(toBlock > currentBlock) {
            toBlock = currentBlock;
        }

        let events = undefined;
        try {
            events = await pairContract.queryFilter('Sync', fromBlock, toBlock); 
        } 
        catch(e) {
            // console.log(`query filter error: ${e.toString()}`);
            blockStep = Math.round(blockStep / 2);
            if(blockStep < 1000) {
                blockStep = 1000;
            }
            toBlock = 0;
            cptError++;
            continue;
        }

        console.log(`${fnName()} [${pairKey}]: [${fromBlock} - ${toBlock}] found ${events.length} Sync events after ${cptError} errors (fetched ${toBlock-fromBlock+1} blocks)`);
        cptError = 0;
        
        if(events.length > 0) {
            let previousEvent = events[0];
            // for each events, we will only save the last event of a block
            for(let i = 1; i < events.length; i++) {
                const workingEvent = events[i];
                
                // we save the 'previousEvent' when the workingEvent block number is different than the previousEvent
                if(workingEvent.blockNumber != previousEvent.blockNumber) {
                    liquidityValues.push({
                        blockNumber: previousEvent.blockNumber,
                        reserve0: previousEvent.args.reserve0.toString(),
                        reserve1: previousEvent.args.reserve1.toString()
                    });
                }
                
                if(i == events.length -1) {
                    // always save the last event
                    liquidityValues.push({
                        blockNumber: workingEvent.blockNumber,
                        reserve0: workingEvent.args.reserve0.toString(),
                        reserve1: workingEvent.args.reserve1.toString()
                    });
                }
    
                previousEvent = workingEvent;
            }
    
            if(liquidityValues.length >= MINIMUM_TO_APPEND) {
                const textToAppend = liquidityValues.map(_ => `${_.blockNumber},${_.reserve0},${_.reserve1}`);
                fs.appendFileSync(historyFileName, textToAppend.join('\n') + '\n');
                liquidityValues = [];
            }
            // try to find the blockstep to reach 8000 events per call as the RPC limit is 10 000, 
            // this try to change the blockstep by increasing it when the pool is not very used
            // or decreasing it when the pool is very used
            blockStep = Math.min(100000, Math.round(blockStep * 8000 / events.length));
        }

        fromBlock = toBlock +1;
    }
    
    if(liquidityValues.length > 0) {
        const textToAppend = liquidityValues.map(_ => `${_.blockNumber},${_.reserve0},${_.reserve1}`);
        fs.appendFileSync(historyFileName, textToAppend.join('\n') + '\n');
    }
}

UniswapV2HistoryFetcher();