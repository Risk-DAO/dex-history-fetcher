const { ethers, Contract } = require('ethers');

const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const univ3Config = require('./uniswap.v3.config');
const globalConfig = require('../global.config');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const { fnName, logFnDuration } = require('../utils/utils');
const { normalize, getTokenSymbolByAddress } = require('../utils/token.utils');
const { getPriceNormalized, getVolumeForSlippage } = require('./uniswap.v3.utils');
const { default: BigNumber } = require('bignumber.js');

const RPC_URL = process.env.RPC_URL;
const DATA_DIR = process.cwd() + '/data';

UniswapV3HistoryFetcher();

/**
 * Fetch all liquidity history from UniswapV2 pairs
 * The pairs to fetch are read from the config file './uniswap.v2.config'
 */
async function UniswapV3HistoryFetcher() {
    if(!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }

    if(!fs.existsSync(`${DATA_DIR}/uniswapv3`)) {
        fs.mkdirSync(`${DATA_DIR}/uniswapv3`);
    }

    console.log(`${fnName()}: starting`);
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
    const univ3Factory = new Contract(univ3Config.uniswapFactoryV3Address, univ3Config.uniswapFactoryV3Abi, web3Provider);
    const currentBlock = await web3Provider.getBlockNumber();

    for(const pairToFetch of univ3Config.pairsToFetch) {
        await FetchUniswapV3HistoryForPair(pairToFetch, web3Provider, univ3Factory, currentBlock);
    }

    // const pairToFetch = univ3Config.pairsToFetch[0];
    // const token0 = globalConfig.tokens[pairToFetch.token0];
    // if(!token0) {
    //     throw new Error('Cannot find token in global config with symbol: ' + pairToFetch.token0);
    // }
    // const token1 = globalConfig.tokens[pairToFetch.token1];
    // if(!token1) {
    //     throw new Error('Cannot find token in global config with symbol: ' + pairToFetch.token1);
    // }
    // const poolAddress = await univ3Factory.getPool(token0.address, token1.address, pairToFetch.fees);
    // // console.log(poolAddress);
    // // const currentBlock = await web3Provider.getBlockNumber();
    // const deployedBlock = await GetContractCreationBlockNumber(web3Provider, poolAddress);
    // const endBlock = deployedBlock + 1499;

    // // univ3Factory.queryFilter()

    // // const topicBurn = ethers.utils.id('Burn(address,int24,int24,uint128,uint256,uint256)');
    // // const topicMint = ethers.utils.id('Mint(address,address,int24,int24,uint128,uint256,uint256)');
    // const univ3PairContract = new Contract(poolAddress, univ3Config.uniswapV3PairAbi, web3Provider);
    // const mintEvents = await univ3PairContract.queryFilter('Mint', deployedBlock, endBlock);
    // const burnEvents = await univ3PairContract.queryFilter('Burn', deployedBlock, endBlock);
    // // const filterBurn = univ3PairContract.filters.Burn();
    // // const filterMint = univ3PairContract.filters.Mint();
    // // const filterSwap = univ3PairContract.filters.Swap();

    // // let iface = new ethers.utils.Interface(univ3Config.uniswapV3PairAbi);
    // // const events = await univ3PairContract.queryFilter({
    // //     topics: [[
    // //         filterBurn.topics[0],
    // //         filterMint.topics[0],
    // //         filterSwap.topics[0]]]
    // // }, deployedBlock, deployedBlock + 1500);
    
    // // events.forEach(_ => {
    // //     try {
    // //         _.parsed = iface.parseLog(_);
    // //         // if(parsed.name == 'Swap') {
    // //         //     console.log(`Block [${_.blockNumber}]: ${parsed.name}, liquidity: ${parsed.args.liquidity}`);
    // //         // } else {
    // //         //     console.log(`Block [${_.blockNumber}]: ${parsed.name}, liquidity: ${parsed.args.amount}`);
    // //         // }
    // //     }
    // //     catch(e) {
    // //         console.log(e);
    // //     }
    // // });

    // const liquidity = {};
    // mintEvents.forEach((mintEvent) => {
    //     const upperTick = Number(mintEvent.args.tickUpper);
    //     const lowerTick = Number(mintEvent.args.tickLower);
    //     const addedOrRemovedLiquidity = normalize(mintEvent.args.amount, 18);

    //     for(let tick = lowerTick ; tick <= upperTick ; tick++) {
    //         if(!liquidity[tick]) {
    //             liquidity[tick] = 0;
    //         }
    //         liquidity[tick] += addedOrRemovedLiquidity;
    //     }
    // });

    
    // burnEvents.forEach((burnEvent) => {
    //     const upperTick = Number(burnEvent.args.tickUpper);
    //     const lowerTick = Number(burnEvent.args.tickLower);
    //     const addedOrRemovedLiquidity = normalize(burnEvent.args.amount, 18);

    //     for(let tick = lowerTick ; tick <= upperTick ; tick++) {
    //         if(!liquidity[tick]) {
    //             liquidity[tick] = 0;
    //         }
    //         liquidity[tick] -= addedOrRemovedLiquidity;
    //     }
    // });

    // // console.log(`Liquidity at end of block ${deployedBlock + 1500}: `, liquidity);
    // fs.writeFileSync('liquidity.json', JSON.stringify(liquidity));

    // let pairInterface = new ethers.utils.Interface(univ3Config.uniswapV3PairAbi);

    // let slot0Data = await web3Provider.call({
    //     to: poolAddress,
    //     data: pairInterface.encodeFunctionData('slot0'),
    // }, endBlock);

    // const decodedSlot0Data = pairInterface.decodeFunctionResult('slot0', slot0Data);



    console.log('UniswapV3HistoryFetcher: ending');
}

async function FetchUniswapV3HistoryForPair(pairConfig, web3Provider, univ3Factory, currentBlock) {
    console.log(`${fnName()}: start for pair ${pairConfig.token0}-${pairConfig.token1}`);
    const token0 = globalConfig.tokens[pairConfig.token0];
    if(!token0) {
        throw new Error('Cannot find token in global config with symbol: ' + pairConfig.token0);
    }
    const token1 = globalConfig.tokens[pairConfig.token1];
    if(!token1) {
        throw new Error('Cannot find token in global config with symbol: ' + pairConfig.token1);
    }

    const poolAddress = await univ3Factory.getPool(token0.address, token1.address, pairConfig.fees);
    const univ3PairContract = new Contract(poolAddress, univ3Config.uniswapV3PairAbi, web3Provider);

    // verify that the token0 in config is the token0 of the pool
    const poolToken0 = await univ3PairContract.token0();
    if(poolToken0.toLowerCase() != token0.address.toLowerCase()) {
        throw new Error(`pool token0 ${poolToken0} != config token0 ${token0.address}. config must match pool order`);
    }
    // same for token1
    const poolToken1 = await univ3PairContract.token1();
    if(poolToken1.toLowerCase() != token1.address.toLowerCase()) {
        throw new Error(`pool token0 ${poolToken1} != config token0 ${token1.address}. config must match pool order`);
    }

    console.log(`${fnName()}: pool address found: ${poolAddress} with pair ${pairConfig.token0}-${pairConfig.token1}`);
    // try to find the json file representation of the pool latest value already fetched
    const latestDataFilePath = `${DATA_DIR}/uniswapv3/${pairConfig.token0}-${pairConfig.token0}-${poolAddress}-latestdata.json`;
    let latestData = undefined;

    if(fs.existsSync(latestDataFilePath)) {
        // if the file exists, set its value to latestData
        latestData = JSON.parse(fs.readFileSync(latestDataFilePath));
        console.log(`${fnName()}: data file found ${latestDataFilePath}, last block fetched: ${latestData.blockNumber}`);
    } else {
        console.log(`${fnName()}: data file not found, starting from scratch`);
        latestData = await fetchInitializeData(web3Provider, poolAddress, univ3PairContract);
    }

    // here, latest data is not null as it's either read from checkpoint file or from initialize events
    // we will fetch swap data in step from latestData.blockNumber to currentBlock
    const filterBurn = univ3PairContract.filters.Burn();
    const filterMint = univ3PairContract.filters.Mint();
    const filterSwap = univ3PairContract.filters.Swap();
    let iface = new ethers.utils.Interface(univ3Config.uniswapV3PairAbi);

    const initBlockStep = 7000;
    let blockStep = initBlockStep;
    let fromBlock =  latestData.blockNumber + 1;
    let toBlock = 0;
    let cptError = 0;
    while(toBlock < currentBlock) {
        toBlock = fromBlock + blockStep - 1;
        if(toBlock > currentBlock) {
            toBlock = currentBlock;
        }

        let events = undefined;
        try {
            events = await univ3PairContract.queryFilter({
                topics: [[
                    filterBurn.topics[0],
                    filterMint.topics[0],
                    filterSwap.topics[0]]]
            }, fromBlock, toBlock);
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

        console.log(`${fnName()}: [${fromBlock} - ${toBlock}] found ${events.length} Mint/Burn/Swap events after ${cptError} errors (fetched ${toBlock-fromBlock+1} blocks)`);
        
        // try to find the blockstep to reach 9000 events per call as the RPC limit is 10 000, 
        // this try to change the blockstep by increasing it when the pool is not very used
        // or decreasing it when the pool is very used
        const ratioEvents = 9000 / events.length;
        blockStep = Math.round(blockStep * ratioEvents);
        cptError = 0;
        await processEvents(events, iface, latestData, token0, token1, latestDataFilePath, web3Provider, poolAddress);
        fromBlock = toBlock +1;
    }
}

async function processEvents(events, iface, latestData, token0, token1, latestDataFilePath) {
    const dtStart = Date.now();
    const dataToWriteZeroToOne = [];
    const dataToWriteOneToZero = [];
    let lastBlock = events[0].blockNumber;
    let lastBlockWritten = latestData.blockNumber;
    for (const event of events) {
        const parsedEvent = iface.parseLog(event);
        if(lastBlock != event.blockNumber
            // maximum write every 1000 blocks because very time consuming
            && lastBlock > lastBlockWritten + 1000) {
            savePriceAndSlippageData(token0, token1, latestData, dataToWriteZeroToOne, dataToWriteOneToZero);
            lastBlockWritten = lastBlock;
        }

        lastBlock = event.blockNumber;

        if (parsedEvent.name == 'Mint') {
            if (parsedEvent.args.amount.gt(0)) {
                updateLatestDataLiquidity(latestData, event.blockNumber, parsedEvent.args.tickLower, parsedEvent.args.tickUpper, new BigNumber(parsedEvent.args.amount.toString()), latestData.tickSpacing);
            } else {
                // console.log(`${fnName()}: ignoring Mint event because amount= ${parsedEvent.args.amount}`);
            }
        } else if (parsedEvent.name == 'Burn') {
            if (parsedEvent.args.amount.gt(0)) {
                updateLatestDataLiquidity(latestData, event.blockNumber, parsedEvent.args.tickLower, parsedEvent.args.tickUpper, new BigNumber(-1).times(new BigNumber(parsedEvent.args.amount.toString())), latestData.tickSpacing);
            } else {
                // console.log(`${fnName()}: ignoring Burn event because amount= ${parsedEvent.args.amount}`);
            }
        } else if (parsedEvent.name == 'Swap') {
            latestData.currentSqrtPriceX96 = parsedEvent.args.sqrtPriceX96.toString();
            latestData.currentTick = parsedEvent.args.tick;
            latestData.blockNumber = event.blockNumber;
        }

    }
    
    // at the end, write the last data
    savePriceAndSlippageData(token0, token1, latestData, dataToWriteZeroToOne, dataToWriteOneToZero);

    const token0Symbol = getTokenSymbolByAddress(token0.address);
    const token1Symbol = getTokenSymbolByAddress(token1.address);
    const t0t1FileName = `${DATA_DIR}/uniswapv3/${token0Symbol}-${token1Symbol}_uniswapv3.csv`;
    const t1t0FileName = `${DATA_DIR}/uniswapv3/${token1Symbol}-${token0Symbol}_uniswapv3.csv`;
    if(!fs.existsSync(t0t1FileName)) {
        fs.writeFileSync(t0t1FileName, 'blocknumber,data');
        fs.writeFileSync(t1t0FileName, 'blocknumber,data');
    }
    fs.appendFileSync(t0t1FileName, dataToWriteZeroToOne.join(''));
    fs.appendFileSync(t1t0FileName, dataToWriteOneToZero.join(''));
    fs.writeFileSync(latestDataFilePath, JSON.stringify(latestData));
    logFnDuration(dtStart, dataToWriteZeroToOne.length);
}

function updateLatestDataLiquidity(latestData, blockNumber, tickLower, tickUpper, amount, tickSpacing) {
    // console.log(`${fnName()}: updating ${amount} liquidity to ticks ${tickLower} to ${tickUpper} at block ${blockNumber}`);

    // fs.appendFileSync('logs.txt', `[${blockNumber}] [${amount < 0 ? 'BURN': 'MINT'}]: lqty change: ${amount} from ${tickLower} to ${tickUpper}\n`);
    for(let tick = tickLower ; tick <= tickUpper ; tick += tickSpacing) {
        if(!latestData.ticks[tick]) {
            latestData.ticks[tick] = new BigNumber(0);
        }

        // always add because for burn events amount will be < 0
        latestData.ticks[tick] = new BigNumber(latestData.ticks[tick]).plus(amount).toString();
    }

    latestData.blockNumber = blockNumber;
}


function savePriceAndSlippageData(token0, token1, latestData, zeroToOneArrayData, oneToZeroArrayData) {
    const dtStart = Date.now();
    const nextLowestTick = (Math.floor(latestData.currentTick / latestData.tickSpacing)) * latestData.tickSpacing;

    // SAVE token0->token1 data
    let zeroToOne = true;
    const p0 = getPriceNormalized(zeroToOne, nextLowestTick, latestData.tickSpacing, latestData.currentSqrtPriceX96.toString(), latestData.ticks, new BigNumber('1'), token0.decimals, token1.decimals);
    const t0t1SlippageObj = {};
    t0t1SlippageObj.price = p0;
    t0t1SlippageObj.slippage = {};
    let lastVolume = undefined;
    const maxSlippage = 20;
    for(let slippagePercent = 1; slippagePercent <= maxSlippage; slippagePercent++) {
        const volume1ForSlippage = getVolumeForSlippage(slippagePercent, zeroToOne, nextLowestTick, latestData.tickSpacing, latestData.currentSqrtPriceX96.toString(), latestData.ticks);
        const normalized = normalize(volume1ForSlippage.toString(), token0.decimals);
        if(lastVolume && lastVolume == normalized) {
            break;
        } 

        // console.log(`volume for slippage: ${normalized} ${getTokenSymbolByAddress(token0.address)}`);
        t0t1SlippageObj.slippage[slippagePercent] = normalized;
        lastVolume = normalized;
    }

    zeroToOneArrayData.push(`${latestData.blockNumber},${JSON.stringify(t0t1SlippageObj)}\n`);

    // SAVE token1->token0 data
    zeroToOne = false;
    const p1 = getPriceNormalized(zeroToOne, nextLowestTick, latestData.tickSpacing, latestData.currentSqrtPriceX96.toString(), latestData.ticks, new BigNumber('1'), token0.decimals, token1.decimals);
    const t1t0SlippageObj = {};
    t1t0SlippageObj.price = p1;
    t1t0SlippageObj.slippage = {};
    lastVolume = undefined;
    for(let slippagePercent = 1; slippagePercent <= maxSlippage; slippagePercent++) {
        const volume1ForSlippage = getVolumeForSlippage(slippagePercent, zeroToOne, nextLowestTick, latestData.tickSpacing, latestData.currentSqrtPriceX96.toString(), latestData.ticks);
        const normalized = normalize(volume1ForSlippage.toString(), token1.decimals);
        if(lastVolume && lastVolume == normalized) {
            break;
        } 
        // console.log(`volume for slippage: ${normalized} ${getTokenSymbolByAddress(token1.address)}`);
        t1t0SlippageObj.slippage[slippagePercent] = normalized;
        lastVolume = normalized;
    }

    oneToZeroArrayData.push(`${latestData.blockNumber},${JSON.stringify(t1t0SlippageObj)}\n`);
    logFnDuration(dtStart);
}

async function fetchInitializeData(web3Provider, poolAddress, univ3PairContract) {
    // if the file does not exists, it means we start from the beginning
    // fetch the deployed block number for the pool
    const deployedBlock = await GetContractCreationBlockNumber(web3Provider, poolAddress);
    let fromBlock = deployedBlock;
    let toBlock = deployedBlock + 100000;
    let latestData = undefined;
    while (!latestData) {
        console.log(`${fnName()}: searching Initialize event between blocks [${fromBlock} - ${toBlock}]`);
        const initEvents = await univ3PairContract.queryFilter('Initialize', fromBlock, toBlock);
        if (initEvents.length > 0) {
            if (initEvents > 1) {
                throw new Error('More than 1 Initialize event found???');
            }

            console.log(`${fnName()}: found Initialize event at block ${initEvents[0].blockNumber}`);

            latestData = {
                currentTick: initEvents[0].args.tick,
                currentSqrtPriceX96: initEvents[0].args.sqrtPriceX96.toString(),
                blockNumber: initEvents[0].blockNumber - 1, // set to blocknumber -1 to be sure to fetch mint/burn events on same block as initialize,
                tickSpacing: await univ3PairContract.tickSpacing(),
                ticks: {}
            };

            // fs.appendFileSync('logs.txt', `Initialized at ${initEvents[0].blockNumber}. base tick ${latestData.currentTick}. base price: ${latestData.currentSqrtPriceX96}\n`);

        } else {
            console.log(`${fnName()}: Initialize event not found between blocks [${fromBlock} - ${toBlock}]`);
            fromBlock = toBlock + 1;
            toBlock = fromBlock + 100000;
        }
    }
    return latestData;
}