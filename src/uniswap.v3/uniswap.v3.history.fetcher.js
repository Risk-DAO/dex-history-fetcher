const { ethers, Contract } = require('ethers');

const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const univ3Config = require('./uniswap.v3.config');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const { fnName, logFnDuration, sleep, roundTo } = require('../utils/utils');
const { getConfTokenBySymbol } = require('../utils/token.utils');
const { getPriceNormalized, getSlippages } = require('./uniswap.v3.utils');
const { default: BigNumber } = require('bignumber.js');
const { RecordMonitoring } = require('../utils/monitoring');
const CONSTANT_1e18 = new BigNumber(10).pow(18);
// save liquidity data every 'CONSTANT_BLOCK_INTERVAL' blocks
const CONSTANT_BLOCK_INTERVAL = 150;

const RPC_URL = process.env.RPC_URL;
const DATA_DIR = process.cwd() + '/data';

UniswapV3HistoryFetcher();

/**
 * Fetch all liquidity history from UniswapV2 pairs
 * The pairs to fetch are read from the config file './uniswap.v2.config'
 */
async function UniswapV3HistoryFetcher() {
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const start = Date.now();
        try {
            await RecordMonitoring({
                'name': 'UniswapV3 Fetcher',
                'status': 'running',
                'lastStart': Math.round(start/1000),
                'runEvery': 10 * 60
            });

            if(!RPC_URL) {
                throw new Error('Could not find RPC_URL env variable');
            }

            if(!fs.existsSync(`${DATA_DIR}/uniswapv3`)) {
                fs.mkdirSync(`${DATA_DIR}/uniswapv3`);
            }

            console.log(`${fnName()}: starting`);
            const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
            const univ3Factory = new Contract(univ3Config.uniswapFactoryV3Address, univ3Config.uniswapFactoryV3Abi, web3Provider);
            const currentBlock = await web3Provider.getBlockNumber() - 10;

            for(const pairToFetch of univ3Config.pairsToFetch) {
                await FetchUniswapV3HistoryForPair(pairToFetch, web3Provider, univ3Factory, currentBlock);
            }

            const runEndDate = Math.round(Date.now()/1000);
            await RecordMonitoring({
                'name': 'UniswapV3 Fetcher',
                'status': 'success',
                'lastEnd': runEndDate,
                'lastDuration': runEndDate - Math.round(start/1000),
                'lastBlockFetched': currentBlock
            });
        } catch(error) {
            const errorMsg = `An exception occurred: ${error}`;
            console.log(errorMsg);
            await RecordMonitoring({
                'name': 'UniswapV3 Fetcher',
                'status': 'error',
                'error': errorMsg
            });
        }

        const sleepTime = 10 * 60 * 1000 - (Date.now() - start);
        if(sleepTime > 0) {
            console.log(`${fnName()}: sleeping ${roundTo(sleepTime/1000/60)} minutes`);
            await sleep(sleepTime);
        }
    }
}

async function FetchUniswapV3HistoryForPair(pairConfig, web3Provider, univ3Factory, currentBlock) {
    console.log(`${fnName()}[${pairConfig.token0}-${pairConfig.token1}]: start for pair ${pairConfig.token0}-${pairConfig.token1} and fees: ${pairConfig.fees}`);
    const token0 = getConfTokenBySymbol(pairConfig.token0);
    if(!token0) {
        throw new Error('Cannot find token in global config with symbol: ' + pairConfig.token0);
    }
    const token1 = getConfTokenBySymbol(pairConfig.token1);
    if(!token1) {
        throw new Error('Cannot find token in global config with symbol: ' + pairConfig.token1);
    }

    // try to find the json file representation of the pool latest value already fetched
    const latestDataFilePath = `${DATA_DIR}/uniswapv3/${pairConfig.token0}-${pairConfig.token1}-${pairConfig.fees}-latestdata.json`;
    let latestData = undefined;
    let poolAddress = undefined;
    let univ3PairContract = undefined;

    if(fs.existsSync(latestDataFilePath)) {
        // if the file exists, set its value to latestData
        latestData = JSON.parse(fs.readFileSync(latestDataFilePath));
        poolAddress = latestData.poolAddress;
        if(!poolAddress) {
            console.log(`Could not find pool address in latest data file ${latestDataFilePath}`);
            poolAddress = await univ3Factory.getPool(token0.address, token1.address, pairConfig.fees);
            latestData.poolAddress = poolAddress;
        }

        univ3PairContract = new Contract(poolAddress, univ3Config.uniswapV3PairAbi, web3Provider);
        console.log(`${fnName()}[${pairConfig.token0}-${pairConfig.token1}-${pairConfig.fees}]: data file found ${latestDataFilePath}, last block fetched: ${latestData.blockNumber}`);
    } else {
        console.log(`${fnName()}[${pairConfig.token0}-${pairConfig.token1}-${pairConfig.fees}]: data file not found, starting from scratch`);
        poolAddress = await univ3Factory.getPool(token0.address, token1.address, pairConfig.fees);
        univ3PairContract = new Contract(poolAddress, univ3Config.uniswapV3PairAbi, web3Provider);

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

        console.log(`${fnName()}[${pairConfig.token0}-${pairConfig.token1}]: pool address found: ${poolAddress} with pair ${pairConfig.token0}-${pairConfig.token1}`);
        latestData = await fetchInitializeData(web3Provider, poolAddress, univ3PairContract);
        latestData.poolAddress = poolAddress;
    }

    const dataFileName = `${DATA_DIR}/uniswapv3/${token0.symbol}-${token1.symbol}-${pairConfig.fees}-data.csv`;
    if(!fs.existsSync(dataFileName)) {
        fs.writeFileSync(dataFileName, 'blocknumber,data\n');
    }

    // here, latest data is not null as it's either read from checkpoint file or from initialize events
    // we will fetch swap data in step from latestData.blockNumber to currentBlock
    const filterBurn = univ3PairContract.filters.Burn();
    const filterMint = univ3PairContract.filters.Mint();
    const filterSwap = univ3PairContract.filters.Swap();
    let iface = new ethers.utils.Interface(univ3Config.uniswapV3PairAbi);

    const initBlockStep = 50000;
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

        console.log(`${fnName()}[${pairConfig.token0}-${pairConfig.token1}-${pairConfig.fees}]: [${fromBlock} - ${toBlock}] found ${events.length} Mint/Burn/Swap events after ${cptError} errors (fetched ${toBlock-fromBlock+1} blocks)`);
        
        if(events.length != 0) {
            processEvents(events, iface, latestData, token0, token1, latestDataFilePath, dataFileName);

            // try to find the blockstep to reach 9000 events per call as the RPC limit is 10 000, 
            // this try to change the blockstep by increasing it when the pool is not very used
            // or decreasing it when the pool is very used
            blockStep = Math.min(1_000_000, Math.round(blockStep * 8000 / events.length));
            cptError = 0;
        } else {
            // if 0 events, multiply blockstep by 4
            blockStep = blockStep * 4;
        }
        fromBlock = toBlock +1;
    }

    // at the end, update latest data blockNumber because even if no events were emitted, we must 
    // save that we have fetched blocks without events
    latestData.blockNumber = currentBlock;
    fs.writeFileSync(latestDataFilePath, JSON.stringify(latestData));
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
                lastCheckpoint: 0, // set to 0 to save liquidity check point at the begining
                lastDataSave: 0, // set to 0 to save data at the beginning
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

function processEvents(events, iface, latestData, token0, token1, latestDataFilePath, dataFileName) {
    const dtStart = Date.now();
    const saveData = [];
    // const priceData = [];
    // const checkpointData = [];
    let lastBlock = events[0].blockNumber;
    for (const event of events) {
        const parsedEvent = iface.parseLog(event);

        // this checks that we are crossing a new block, so we will save the price and maybe checkpoint data
        if(lastBlock != event.blockNumber && lastBlock >= latestData.lastDataSave + CONSTANT_BLOCK_INTERVAL) {
            const newSaveData = getSaveData(token0, token1, latestData);
            saveData.push(newSaveData);
        }

        switch(parsedEvent.name.toLowerCase()) {
            case 'mint':
                if (parsedEvent.args.amount.gt(0)) {
                    const lqtyToAdd = new BigNumber(parsedEvent.args.amount.toString());
                    updateLatestDataLiquidity(latestData, event.blockNumber, parsedEvent.args.tickLower, parsedEvent.args.tickUpper, lqtyToAdd, latestData.tickSpacing);
                }
                break;
            case 'burn':
                if (parsedEvent.args.amount.gt(0)) {
                    const lqtyToSub = new BigNumber(-1).times(new BigNumber(parsedEvent.args.amount.toString()));
                    updateLatestDataLiquidity(latestData, event.blockNumber, parsedEvent.args.tickLower, parsedEvent.args.tickUpper, lqtyToSub, latestData.tickSpacing);
                }
                break;
            case 'swap':
                latestData.currentSqrtPriceX96 = parsedEvent.args.sqrtPriceX96.toString();
                latestData.currentTick = parsedEvent.args.tick;
                latestData.blockNumber = event.blockNumber;
                break;
        }

        lastBlock = event.blockNumber;
    }
    
    // at the end, write the last data if not already saved
    if(latestData.blockNumber != latestData.lastDataSave && latestData.blockNumber >= latestData.lastDataSave + CONSTANT_BLOCK_INTERVAL) {
        const newSaveData = getSaveData(token0, token1, latestData);
        saveData.push(newSaveData);
    }

    fs.appendFileSync(dataFileName, saveData.join(''));
    
    fs.writeFileSync(latestDataFilePath, JSON.stringify(latestData));
    logFnDuration(dtStart, events.length, 'event');
}

function updateLatestDataLiquidity(latestData, blockNumber, tickLower, tickUpper, amount, tickSpacing) {
    // console.log(`Adding ${amount} from ${tickLower} to ${tickUpper}`);
    const amountNorm = amount.div(CONSTANT_1e18).toNumber();
    for(let tick = tickLower ; tick <= tickUpper ; tick += tickSpacing) {
        if(!latestData.ticks[tick]) {
            latestData.ticks[tick] = 0;
        }

        // always add because for burn events, amount value will be < 0
        latestData.ticks[tick] += amountNorm;
    }

    latestData.blockNumber = blockNumber;
}

function getSaveData(token0, token1, latestData) {
    // Compute token0->token1 price
    const p0 = getPriceNormalized(latestData.currentTick, token0.decimals, token1.decimals);

    const slippages = getSlippages(latestData.currentTick, latestData.tickSpacing, latestData.currentSqrtPriceX96.toString(), latestData.ticks, token0.decimals, token1.decimals);
    const saveValue = {
        p0vs1: p0,
        p1vs0: 1/p0
    };

    saveValue[`${token0.symbol}-slippagemap`] = slippages.token0Slippage;
    saveValue[`${token1.symbol}-slippagemap`] = slippages.token1Slippage;

    latestData.lastDataSave = latestData.blockNumber;
    return `${latestData.blockNumber},${JSON.stringify(saveValue)}\n`;
}
