const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const univ2Config = require('./uniswap.v2.config');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const { sleep } = require('../utils/utils');

const RPC_URL = process.env.RPC_URL;

/**
 * Fetches all history for a uniswap v2 pair (a pool)
 * Store the results into a csv file, and use the file as start for a run
 * if the file does not exists, create it and start at the contract deploy block
 * if the file exists, start at the last block fetched + 1
 * @param {ethers.providers.BaseProvider} web3Provider 
 * @param {string} pairKey
 */
async function FetchHistoryForPair(web3Provider, pairKey, historyFileName) {
    const pairInfo = univ2Config.uniswapV2Pairs[pairKey];
    const factoryContract = new ethers.Contract(univ2Config.uniswapV2FactoryAddress, univ2Config.uniswapV2FactoryABI, web3Provider);
    const pairAddress = await factoryContract.getPair(pairInfo[0].address, pairInfo[1].address);

    const pairContract = new ethers.Contract(pairAddress, univ2Config.uniswapV2PairABI, web3Provider);
    const currentBlock = await web3Provider.getBlockNumber();

    const initStepBlock = 5000;
    let stepBlock = initStepBlock;

    let startBlock = undefined;
    if(!fs.existsSync(historyFileName)) {
        fs.writeFileSync(historyFileName, `blocknumber,reserve_${pairInfo[0].symbol}_${pairInfo[0].address},reserve_${pairInfo[1].symbol}_${pairInfo[1].address}\n`);
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
    for(let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += stepBlock) {
        let toBlock = fromBlock + stepBlock - 1; // add stepBlock -1 because the fromBlock counts in the number of block fetched
        if(toBlock > currentBlock) {
            toBlock = currentBlock;
        }

        let events;
        try {
            events = await pairContract.queryFilter('Sync', fromBlock, toBlock); 
        } 
        catch(err) {
            fromBlock -= stepBlock;
            stepBlock = stepBlock / 2;
            console.log(`Exception: ${err.message}, will retry with new step: ${stepBlock}`);
            await sleep(5000);
            continue;
        }

        stepBlock = initStepBlock;
        let previousEvent = events[0];
        
        for(let i = 1; i < events.length; i++) {
            const workingEvent = events[i];
            
            if(workingEvent.blockNumber != previousEvent.blockNumber) {
                liquidityValues.push({
                    blockNumber: previousEvent.blockNumber,
                    reserve0: previousEvent.args.reserve0.toString(),
                    reserve1: previousEvent.args.reserve1.toString()
                });
            }
            
            if(i == events.length -1) {
                // on the last iteration
                liquidityValues.push({
                    blockNumber: workingEvent.blockNumber,
                    reserve0: workingEvent.args.reserve0.toString(),
                    reserve1: workingEvent.args.reserve1.toString()
                });
            }

            previousEvent = workingEvent;
        }

        console.log(`FetchHistoryForPair[${pairKey}]: from ${fromBlock} to ${toBlock}`);
        
        if(liquidityValues.length >= 5000) {
            const textToAppend = liquidityValues.map(_ => `${_.blockNumber},${_.reserve0},${_.reserve1}`);
            fs.appendFileSync(historyFileName, textToAppend.join('\n') + '\n');
            liquidityValues = [];
        }
    }
    
    if(liquidityValues.length > 0) {
        const textToAppend = liquidityValues.map(_ => `${_.blockNumber},${_.reserve0},${_.reserve1}`);
        fs.appendFileSync(historyFileName, textToAppend.join('\n') + '\n');
    }
}

async function UniswapV2HistoryFetcher() {
    if(!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }

    console.log('UniswapV2HistoryFetcher: starting');
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);

    for(const pairKey of Object.keys(univ2Config.uniswapV2Pairs)) {
        await FetchHistoryForPair(web3Provider, pairKey, `./data/${pairKey}_uniswapv2.csv`);
    }

    
}

UniswapV2HistoryFetcher();