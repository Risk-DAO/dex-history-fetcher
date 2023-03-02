const { ethers, Contract } = require('ethers');

const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const univ3Config = require('./uniswap.v3.config');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const { fnName, logFnDuration, sleep } = require('../utils/utils');
const { getTokenSymbolByAddress, getConfTokenBySymbol } = require('../utils/token.utils');
const { getPriceNormalized, getSlippages } = require('./uniswap.v3.utils');
const { default: BigNumber } = require('bignumber.js');
// save liqiudity data every 'CHECKPOINT_INTERVAL' blocks
const CHECKPOINT_INTERVAL = 100_000;
const CONSTANT_1e18 = new BigNumber(10).pow(18);

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

        console.log('UniswapV3HistoryFetcher: ending');
        await sleep(1000 * 600);
    }
}

async function FetchUniswapV3HistoryForPair(pairConfig, web3Provider, univ3Factory, currentBlock) {
    console.log(`${fnName()} [${pairConfig.token0}-${pairConfig.token1}]: start for pair ${pairConfig.token0}-${pairConfig.token1}`);
    const token0 = getConfTokenBySymbol(pairConfig.token0);
    if(!token0) {
        throw new Error('Cannot find token in global config with symbol: ' + pairConfig.token0);
    }
    const token1 = getConfTokenBySymbol(pairConfig.token1);
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

    console.log(`${fnName()} [${pairConfig.token0}-${pairConfig.token1}]: pool address found: ${poolAddress} with pair ${pairConfig.token0}-${pairConfig.token1}`);
    // try to find the json file representation of the pool latest value already fetched
    const latestDataFilePath = `${DATA_DIR}/uniswapv3/${pairConfig.token0}-${pairConfig.token1}-${poolAddress}-latestdata.json`;
    let latestData = undefined;

    if(fs.existsSync(latestDataFilePath)) {
        // if the file exists, set its value to latestData
        latestData = JSON.parse(fs.readFileSync(latestDataFilePath));
        console.log(`${fnName()} [${pairConfig.token0}-${pairConfig.token1}]: data file found ${latestDataFilePath}, last block fetched: ${latestData.blockNumber}`);
    } else {
        console.log(`${fnName()} [${pairConfig.token0}-${pairConfig.token1}]: data file not found, starting from scratch`);
        latestData = await fetchInitializeData(web3Provider, poolAddress, univ3PairContract);
    }

    const dataFileName = `${DATA_DIR}/uniswapv3/${token0.symbol}-${token1.symbol}_data.csv`;
    if(!fs.existsSync(dataFileName)) {
        fs.writeFileSync(dataFileName, 'blocknumber,data\n');
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

        console.log(`${fnName()} [${pairConfig.token0}-${pairConfig.token1}]: [${fromBlock} - ${toBlock}] found ${events.length} Mint/Burn/Swap events after ${cptError} errors (fetched ${toBlock-fromBlock+1} blocks)`);
        
        if(events.length != 0) {
            processEvents(events, iface, latestData, token0, token1, latestDataFilePath, dataFileName);

            // try to find the blockstep to reach 9000 events per call as the RPC limit is 10 000, 
            // this try to change the blockstep by increasing it when the pool is not very used
            // or decreasing it when the pool is very used
            const ratioEvents = 9000 / events.length;
            blockStep = Math.round(blockStep * ratioEvents);
            cptError = 0;
        }
        fromBlock = toBlock +1;
    }
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
        if(lastBlock != event.blockNumber && lastBlock >= latestData.lastDataSave + 1000) {
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
    
    // at the end, write the last data
    const newSaveData = getSaveData(token0, token1, latestData);
    saveData.push(newSaveData);
    fs.appendFileSync(dataFileName, saveData.join(''));

    // const priceFilename = `${DATA_DIR}/uniswapv3/${token0.symbol}-${token1.symbol}_prices.csv`;
    // const checkpointFileName = `${DATA_DIR}/uniswapv3/${token0.symbol}-${token1.symbol}_liquidity_checkpoint.csv`;
    // if(!fs.existsSync(priceFilename)) {
    //     fs.writeFileSync(priceFilename, `blocknumber,price ${token1.symbol}/${token0.symbol},price ${token0.symbol}/${token1.symbol}\n`);
    // }

    // if(!fs.existsSync(checkpointFileName)) {
    //     fs.writeFileSync(checkpointFileName, 'blocknumber,liquidity data\n');
    // }
    // if(priceData.length > 0) {
    //     fs.appendFileSync(priceFilename, priceData.join(''));
    // }

    // if(checkpointData.length > 0) {
    //     console.log(`${fnName()} [${token0.symbol}-${token1.symbol}]: saving ${checkpointData.length} checkpoint(s)`);
    //     fs.appendFileSync(checkpointFileName, checkpointData.join(''));
    // }
    
    fs.writeFileSync(latestDataFilePath, JSON.stringify(latestData));
    logFnDuration(dtStart, events.length, 'event');
}

function updateLatestDataLiquidity(latestData, blockNumber, tickLower, tickUpper, amount, tickSpacing) {
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
    // console.log(slippages);
    // Compute token1->token0 price
    // priceData.push(`${latestData.blockNumber},${p0},${1/p0}\n`);

    // if(latestData.blockNumber >= latestData.lastCheckpoint + CHECKPOINT_INTERVAL) {
    //     checkpointData.push(`${latestData.blockNumber},${JSON.stringify(latestData)}\n`);
    //     latestData.lastCheckpoint = latestData.blockNumber;
    // }
}
