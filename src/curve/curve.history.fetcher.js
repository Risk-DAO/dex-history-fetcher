const { ethers, BigNumber } = require('ethers');
const dotenv = require('dotenv');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const curveConfig = require('./curve.config');
const fs = require('fs');
const { sleep, fnName } = require('../utils/utils');
const { getTokenSymbolByAddress, getConfTokenBySymbol, normalize } = require('../utils/token.utils');
dotenv.config();
const RPC_URL = process.env.RPC_URL;
const DATA_DIR = process.cwd() + '/data';
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);

/**
 * the main entrypoint of the script, will run the fetch against all pool in the config
 */
async function CurveHistoryFetcher() {
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const errors = [];

        if(!fs.existsSync(`${DATA_DIR}/curve`)) {
            fs.mkdirSync(`${DATA_DIR}/curve`);
        }

        const lastResults = {};
        for (let i = 0; i < curveConfig.curvePairs.length; i++) {
            if(i > 0) {
                await sleep(5000);
            }
            try {
                const curvePair = curveConfig.curvePairs[i];
                const lastData = await FetchHistory(curvePair);
                lastResults[curvePair.poolName] = lastData;
            }
            catch (error) {
                errors.push(curveConfig.curvePairs[i].poolName);
                console.log('error fetching pool', curveConfig.curvePairs[i].poolName);
                console.log('error fetching pool', error);
            }
        }

        fs.writeFileSync(`${DATA_DIR}/curve/curve_pools_summary.json`, JSON.stringify(lastResults, null, 2));

        if(errors.length > 1) {
            console.log('errors:', errors);
        }

        await sleep(1000 * 600);
    }
}

/**
 * Takes a pool from curve.config.js and outputs liquidity file in /data
 * @param {{poolAddress: string, poolName: string, version: number, abi: string, ampFactor: number, additionnalTransferEvents: {[symbol: string]: string[]}}} pool 
 */
async function FetchHistory(pool) {
    if (!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }
    console.log('-------------------------------');
    console.log('CURVE HistoryFetcher: starting on pool', pool['poolName']);


    /// function variables
    let poolAddress = pool.poolAddress;
    const historyFileName = `${DATA_DIR}/curve/${pool.poolName}_${pool.lpTokenName}_curve.csv`;
    let tokenAddresses = undefined;
    let poolSymbols = [];
    const currentBlock = await web3Provider.getBlockNumber();
    // Fetching tokens in pool
    console.log('--- fetching pool tokens ---');
    try {
        tokenAddresses = await getPoolTokens(pool);
        for (let i = 0; i < tokenAddresses.length; i++) {
            const tokenSymbol = getTokenSymbolByAddress(tokenAddresses[i]);
            if(!tokenSymbol) {
                throw new Error('Could not find token in conf with address:' + tokenAddresses[i]);
            }

            poolSymbols.push(tokenSymbol);
        }

        console.log('Tokens found:', tokenAddresses.length, ':', poolSymbols.join(', '));
        console.log('--- Pool tokens fetched ---');
    }
    catch (error) {
        console.log('Could not fetch token symbol');
        throw error;
    }

    let lastData = {};
    if (fs.existsSync(historyFileName)) {
        // if file exists, taking start block and last block data from file
        const fileContent = fs.readFileSync(historyFileName, 'utf-8').split('\n');
        // read last line
        let lastLine = fileContent[fileContent.length - 1]; 
        if(!lastLine) {
            // last line can be just \n so if lastline empty, check previous line
            lastLine = fileContent[fileContent.length - 2]; 
        }
        
        const lastBlockDataSplt = lastLine.split(',');
        lastData.blockNumber = Number(lastBlockDataSplt[0]);
        lastData.ampFactor = Number(lastBlockDataSplt[1]);
        lastData.lpTokenSupply = BigNumber.from(lastBlockDataSplt[2]);
        lastData.reserves = {};
        for(let i = 3; i < lastBlockDataSplt.length; i++) {
            lastData.reserves[poolSymbols[i-3]] = BigNumber.from(lastBlockDataSplt[i]);
        }
    }
    else {
        // and get the contract creation block number and start fetching from here
        const deployedBlock = await GetContractCreationBlockNumber(web3Provider, poolAddress);
        console.log('deployed block from contract is:', deployedBlock);

        lastData.blockNumber = deployedBlock - 1; // init with -1 to fetch from the contract deployment, usefull if some events appears right from creation
        lastData.ampFactor = pool.ampFactor;
        lastData.lpTokenSupply = BigNumber.from(0);
        lastData.reserves = {};

        // create the csv with headers
        let headers = `blocknumber,ampfactor,lp_supply_${pool.lpTokenAddress}`;
        for (let i = 0; i < tokenAddresses.length; i++) {
            headers += `,reserve_${poolSymbols[i]}_${tokenAddresses[i]}`;
            lastData.reserves[poolSymbols[i]] = BigNumber.from(0);
        }

        fs.writeFileSync(historyFileName, `${headers}\n`);
    }

    // here, we have the last data written in csv in the object 'lastData'
    console.log('lastData', lastData);

    // THIS IS WHERE STUFF HAPPENS, FROM START BLOCK TO END BLOCK
    const initBlockStep = 100000;
    let stepBlock = initBlockStep;
    let fromBlock =  lastData.blockNumber + 1;
    let toBlock = 0;

    while(toBlock < currentBlock) {
        toBlock = fromBlock + stepBlock - 1; // add stepBlock -1 because the fromBlock counts in the number of block fetched
        if (toBlock > currentBlock) {
            toBlock = currentBlock;
        }

        const rangeData = [];
        let lpTokenSupplyEvents = undefined;
        let ampFactors = undefined;
        try {
            // Fetch each token events and store them in rangeData
            for (let i = 0; i < tokenAddresses.length; i++) {
            // console.log(`token ${i + 1}/${tokenAddresses.length}`);
                const tokenSymbol = poolSymbols[i];
                let additionnalTransferEvents = []; 
                if(pool.additionnalTransferEvents && pool.additionnalTransferEvents[tokenSymbol]) {
                    additionnalTransferEvents = pool.additionnalTransferEvents[tokenSymbol];
                }
                const tokenData = await getTokenBalancesInRange(tokenAddresses[i], poolAddress, fromBlock, toBlock, additionnalTransferEvents);
                rangeData.push(tokenData);
            }

            // fetch lp token supply
            lpTokenSupplyEvents = await fetchLpTokenSupply(pool.lpTokenAddress, fromBlock, toBlock);

            // fetch amp factors modifications
            ampFactors = await fetchRampA(pool, fromBlock, toBlock);
        }
        catch(e) {
            stepBlock = Math.round(stepBlock / 2);
            if(stepBlock < 1000) {
                stepBlock = 1000;
            }
            console.log(`${fnName()}[${pool.poolName}]: error fetching range [${fromBlock} - ${toBlock}], will retry with ${stepBlock} block range`);
            toBlock = 0; // set toBlock to 0 to avoid exiting the while on the last loop if an error occurs
            await sleep(2000);
            continue;
        }

        // Compute block numbers from blockList(s)
        // this will output an array of block numbers where each block number is a block number where at least something occured
        // it can be: ampFactor change and/or lp supply change and/or token reserve change
        const blockNumbersForRange = getSortedDeduplicatedBlockList(rangeData, ampFactors, lpTokenSupplyEvents);
        const lpTokenEventsCount = Object.keys(lpTokenSupplyEvents).length;
        const ampFactorsCount = Object.keys(ampFactors).length;
        console.log(`${fnName()}[${pool.poolName}]: fetching range [${fromBlock} - ${toBlock}] (${toBlock-fromBlock+1} blocks). Events occured on ${blockNumbersForRange.length} blocks (${lpTokenEventsCount} lp token Mint/Burn event(s), ${ampFactorsCount} amp factor event(s))`);
        // Construct historical data for each blockNumbersForRange entry
        const dataToWrite = [];
        for (let block = 0; block < blockNumbersForRange.length; block++) {
            // Take first block of blockNumberForRange and compute differences
            const currBlock = blockNumbersForRange[block];
            const currBlockData = {
                blockNumber: currBlock,
                ampFactor: lastData.ampFactor,
                lpTokenSupply: lastData.lpTokenSupply,
                reserves: lastData.reserves,
            };

            // check if there is an ampFactor change
            const newAmpFactor = ampFactors[currBlock];
            if(newAmpFactor) {
                currBlockData.ampFactor = newAmpFactor;
            }

            // check if there's lp supply change
            const totalSupplyChange = lpTokenSupplyEvents[currBlock];
            if(totalSupplyChange) {
                // only use add, when burning total supply, totalSupplyChange will be negative
                currBlockData.lpTokenSupply = currBlockData.lpTokenSupply.add(totalSupplyChange);
            }

            // adding reserves
            for (let j = 0; j < tokenAddresses.length; j++) {
                const token = tokenAddresses[j];
                const tokenSymbol = poolSymbols[j];
                if (token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' 
                    || (token.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' && pool.wethIsEth === true)) {
                    // THIS NEEDS AN ARCHIVE NODE AND IS VERY SLOW
                    const value = await web3Provider.getBalance(pool.poolAddress, currBlock);
                    currBlockData.reserves[tokenSymbol] = value;
                }
                else {
                    // old value
                    const oldValue = currBlockData.reserves[tokenSymbol];
                    let delta = BigNumber.from('0');
                    // Compute new token value
                    // adding tokens going to the pool
                    if (rangeData[j][token]['to'][currBlock]) {
                        delta = delta.add(rangeData[j][token]['to'][currBlock]);
                    }
                    // substracting tokens leaving the pool
                    if (rangeData[j][token]['from'][currBlock]) {
                        delta = delta.sub(rangeData[j][token]['from'][currBlock]);
                    }
                    const newValue = oldValue.add(delta);
                    // push to array
                    currBlockData.reserves[tokenSymbol] = newValue;
                }
            }

            // add curr data to the array that will be written to csv
            const csvVal = getCsvFromDataObj(currBlockData, poolSymbols);
            dataToWrite.push(csvVal);
            // update last data to be the current data
            lastData = currBlockData;
        }
        
        // here, we have all the data that need to be written in the dataToWrite array
        if (dataToWrite.length !== 0) {
            fs.appendFileSync(historyFileName, dataToWrite.join(''));
        }

        fromBlock = toBlock +1;
        if(stepBlock < initBlockStep) {
            stepBlock = stepBlock * 2;
        }
    }
    console.log('CURVE HistoryFetcher: reached last block:', currentBlock);
    console.log('CURVE HistoryFetcher: end');
    console.log('-------------------------------');

    // return the last liquidity fetched for the pool summary
    const lastLiquidityData = {};
    for(let i = 0; i < poolSymbols.length; i++) {
        const tokenConf = getConfTokenBySymbol(poolSymbols[i]);
        const normalizedLiquidity = normalize(lastData.reserves[poolSymbols[i]], tokenConf.decimals);
        lastLiquidityData[poolSymbols[i]] = normalizedLiquidity;
    }
    return lastLiquidityData;
}

function getCsvFromDataObj(dataObj, poolSymbols) {
    let csv = `${dataObj.blockNumber},${dataObj.ampFactor},${dataObj.lpTokenSupply.toString()}`;
    for(let i = 0; i < poolSymbols.length; i++) {
        csv += `,${dataObj.reserves[poolSymbols[i]].toString()}`;
    }

    return csv + '\n';
}

/**
 * gets the pool token addresses in the correct order
 * @param {{poolAddress: string, poolName: string, version: number, abi: string, ampFactor: number}} pool 
 * @returns {Promise<string[]>} array of token addresses
 */
async function getPoolTokens(pool) {
    // most pools are curve pool so init them by default
    let contract = new ethers.Contract(pool['poolAddress'], curveConfig.curvePoolAbi, web3Provider);

    // if the config state that the abi is susdABI, use susd curve pool abi
    if (pool.abi === 'susdABI') {
        contract = new ethers.Contract(pool['poolAddress'], curveConfig.susdCurvePoolAbi, web3Provider);
    }

    // there is no way to know how much tokens are in the pools so we must fetch the coins until it fails
    let tokenIndex = 0;
    const poolTokens = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const tokenAddress = await contract.coins(tokenIndex);
            poolTokens.push(tokenAddress);
            tokenIndex++;
        }
        catch (error) {
            break;
        }
    }

    return poolTokens;
}

/**
 * Getting rampA events
 * for(pool, fromBlock, toBlock) returns {results}
 * @param {string} pool 
 * @param {number} fromBlock 
 * @param {number} toBlock 
 * @returns {Promise<{[blockNumber: number]: number}>}
 */
async function fetchRampA(pool, fromBlock, toBlock) {
    const results = {};
    let poolContract = new ethers.Contract(pool.poolAddress, curveConfig.curvePoolAbi, web3Provider);
    let argName = 'new_A';

    switch (pool.ampType.toLowerCase()) {
        case 'rampa':
            // do nothing, this is the default values
            break;
        case 'newparameters':
            poolContract = new ethers.Contract(pool.poolAddress, curveConfig.newParamAbi, web3Provider);
            argName = 'A';
            break;
        case 'rampagamma':
            poolContract = new ethers.Contract(pool.poolAddress, curveConfig.rampAGammaAbi, web3Provider);
            argName = 'future_A';
            break;
        default: 
            throw new Error('Invalid ampType:', pool.ampType);
    }
    
    const events = await poolContract.queryFilter(pool.ampType, fromBlock, toBlock);
    for (let i = 0; i < events.length; i++) {
        results[events[i].blockNumber] = events[i].args[argName].toString();
    }
    return results;
}

/**
 * for (tokenAddress), (pooladdress) and [blockrange] returns historical data and blocklist
 * @param {string} tokenAddress 
 * @param {string} poolAddress 
 * @param {number} fromBlock
 * @param {number} toBlock
 * @param {string[]} additionalTransferAddresses
 * @returns {Promise<{[key: string]: {to:{[blocknumber: number]: BigNumber}, from:{[blocknumber: number]: BigNumber}, blocklist: number[]}>} rangeData
 */
async function getTokenBalancesInRange(tokenAddress, poolAddress, fromBlock, toBlock, additionalTransferAddresses) {
    let contract = new ethers.Contract(tokenAddress, curveConfig.erc20Abi, web3Provider);
    const blockList = [];

    const results = {
        [tokenAddress]: {
            from: {},
            to: {}
        }
    };

    const filterFrom = contract.filters.Transfer(poolAddress);
    const filterTo = contract.filters.Transfer(null, poolAddress);

    const fromEvents = await contract.queryFilter(filterFrom, fromBlock, toBlock);
    const toEvents = await contract.queryFilter(filterTo, fromBlock, toBlock);
    for(let i = 0; i < additionalTransferAddresses.length; i++) {
        const additionnalContractAddress = additionalTransferAddresses[i];
        contract = new ethers.Contract(additionnalContractAddress, curveConfig.erc20Abi, web3Provider);
        const additionalFromEvents = await contract.queryFilter(filterFrom, fromBlock, toBlock);
        const additionalToEvents = await contract.queryFilter(filterTo, fromBlock, toBlock);

        fromEvents.push(...additionalFromEvents);
        toEvents.push(...additionalToEvents);

        console.log(`Added additional ${additionalFromEvents.length} fromEvents and ${additionalToEvents.length} toEvents`);
    }

    for (let i = 0; i < fromEvents.length; i++) {
        const fromEvent = fromEvents[i];
        const amountTransfered = fromEvent.args[2]; // this is a big number
        if (!results[tokenAddress]['from'][fromEvent.blockNumber]) {
            results[tokenAddress]['from'][fromEvent.blockNumber] = BigNumber.from(0);
        }

        results[tokenAddress]['from'][fromEvent.blockNumber] = results[tokenAddress]['from'][fromEvent.blockNumber].add(amountTransfered);
        if (!blockList.includes(fromEvent.blockNumber)) {
            blockList.push(fromEvent.blockNumber);
        }
    }
    for (let i = 0; i < toEvents.length; i++) {
        const toEvent = toEvents[i];
        const amountTransfered = toEvent.args[2]; // this is a big number
        if (!results[tokenAddress]['to'][toEvent.blockNumber]) {
            results[tokenAddress]['to'][toEvent.blockNumber] = BigNumber.from(0);
        }

        results[tokenAddress]['to'][toEvent.blockNumber] = results[tokenAddress]['to'][toEvent.blockNumber].add(amountTransfered);
        if (!blockList.includes(toEvent.blockNumber)) {
            blockList.push(toEvent.blockNumber);
        }
    }

    results['blockList'] = blockList;
    return results;
}

/**
 * get the blocklist (sorted, deduplicated)
 * @param {{[key: string]: {to:{[blocknumber: number]: BigNumber}, from:{[blocknumber: number]: BigNumber}, blocklist: number[]}} rangeData 
 * @param {{number: number}} ampFactors 
 * @returns 
 */
function getSortedDeduplicatedBlockList(rangeData, ampFactors, lpTokenSupplyEvents) {
    const deduplicatedBlockList = [];
    for (let y = 0; y < rangeData.length; y++) {
        for (let z = 0; z < rangeData[y]['blockList'].length; z++) {
            const blockNumberToAdd = rangeData[y]['blockList'][z];
            if(!deduplicatedBlockList.includes(blockNumberToAdd)) {
                deduplicatedBlockList.push(blockNumberToAdd);
            }
        }
    }
    for (const blockToAdd in ampFactors) {
        if(!deduplicatedBlockList.includes(Number(blockToAdd))) {
            deduplicatedBlockList.push(Number(blockToAdd));
        }
    }

    for(const blockToAdd in lpTokenSupplyEvents) {
        if(!deduplicatedBlockList.includes(Number(blockToAdd))) {
            deduplicatedBlockList.push(Number(blockToAdd));
        }
    }

    return deduplicatedBlockList.sort((a, b) => { return a - b; });
}

async function fetchLpTokenSupply(lpTokenAddress, fromBlock, toBlock) {
    let lpTokenContract = new ethers.Contract(lpTokenAddress, curveConfig.erc20Abi, web3Provider);
    /*event Transfer:
    _from: indexed(address)
    _to: indexed(address)
    _value: uint256*/

    const mintFilter = lpTokenContract.filters.Transfer(ethers.constants.AddressZero);
    const burnFilter = lpTokenContract.filters.Transfer(null, ethers.constants.AddressZero);
    const mintEvents = await lpTokenContract.queryFilter(mintFilter, fromBlock, toBlock);

    const burnEvents = await lpTokenContract.queryFilter(burnFilter, fromBlock, toBlock);
    
    const tokenSupplyEvents = {};
    for(const mintEvent of mintEvents) {
        if(!tokenSupplyEvents[mintEvent.blockNumber]) {
            tokenSupplyEvents[mintEvent.blockNumber] = BigNumber.from(0);
        }

        tokenSupplyEvents[mintEvent.blockNumber] = tokenSupplyEvents[mintEvent.blockNumber].add(mintEvent.args[2]);
    }

    
    for(const burnEvent of burnEvents) {
        if(!tokenSupplyEvents[burnEvent.blockNumber]) {
            tokenSupplyEvents[burnEvent.blockNumber] = BigNumber.from(0);
        }

        tokenSupplyEvents[burnEvent.blockNumber] = tokenSupplyEvents[burnEvent.blockNumber].sub(burnEvent.args[2]);
    }

    return tokenSupplyEvents;
}

CurveHistoryFetcher();