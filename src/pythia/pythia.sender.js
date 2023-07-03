const { ethers, utils, Contract } = require('ethers');
const BigNumber = require('bignumber.js');
const pythiaConfig = require('./pythia.config');
const dotenv = require('dotenv');
const { fnName, roundTo, sleep, retry } = require('../utils/utils');
const { getConfTokenBySymbol } = require('../utils/token.utils');
dotenv.config();
const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { RecordMonitoring } = require('../utils/monitoring');
const { getAverageLiquidityForBlockInterval } = require('../uniswap.v3/uniswap.v3.utils');
const { computeAggregatedVolumeFromPivot } = require('../utils/aggregator');

const DATA_DIR = process.cwd() + '/data';
const TARGET_SLIPPAGE_BPS = 500;
const MONITORING_NAME = 'Pythia Sender';
let slippageCache = {};
async function SendToPythia(daysToAvg) {

    if(!process.env.ETH_PRIVATE_KEY) {
        console.log('Could not find ETH_PRIVATE_KEY env variable');
    }

    if(!process.env.RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }
    
    // also using PYTHIA_RPC_URL because for now the contract is on sepolia
    if(!process.env.PYTHIA_RPC_URL) {
        throw new Error('Could not find PYTHIA_RPC_URL env variable');
    }
    
    // eslint-disable-next-line no-constant-condition
    while(true) {
        const start = Date.now();
        await RecordMonitoring({
            'name': MONITORING_NAME,
            'status': 'running',
            'lastStart': Math.round(start/1000),
            'runEvery': 60 * 60
        });

        try {
            console.log(`Starting pythia sender, will average data since ${daysToAvg} days ago`);

            // reset cache
            slippageCache = {};
            const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
            const signer = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, new ethers.providers.StaticJsonRpcProvider(process.env.PYTHIA_RPC_URL));
            const pythiaContract = new Contract(pythiaConfig.pythiaAddress, pythiaConfig.pythiaAbi, signer);
            const keyEncoderContract = new Contract(pythiaConfig.keyEncoderAddress, pythiaConfig.keyEncoderAbi, signer);

            const allAssets = [];
            const allKeys = [];
            const allValues = [];
            const allUpdateTimes = [];
            
            // find block for 'daysToAvg' days ago
            const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now()/1000) - (daysToAvg * 24 * 60 * 60));
            console.log(`${fnName()}: Will avg liquidity since block ${startBlock}`);
            /*library.externalFunction(param => this.doSomething(param));*/
            const endBlock = await retry((() => web3Provider.getBlockNumber()), []);

            const USDCConf = getConfTokenBySymbol('USDC');

            for(const tokenSymbol of pythiaConfig.tokensToPush) {
                // get config 
                const tokenConf = getConfTokenBySymbol(tokenSymbol);
                console.log(`${fnName()}[${tokenSymbol}]: start working on token ${tokenConf.symbol} with address ${tokenConf.address}`);
                
                console.log(`calling keyEncoderContract.encodeLiquidityKey(${tokenConf.address}, ${USDCConf.address}, ${2}, ${(TARGET_SLIPPAGE_BPS/100)}, ${daysToAvg})`);
                const key = await retry(keyEncoderContract.encodeLiquidityKey, [tokenConf.address, USDCConf.address, 2, (TARGET_SLIPPAGE_BPS/100), daysToAvg]);
                const dataToSend = await getUniv3Average(tokenConf, daysToAvg, startBlock, endBlock);
                
                // get the key from the key encoder contract
                console.log(`${fnName()}[${tokenSymbol}]: data to send:`, dataToSend);
                allAssets.push(dataToSend.asset);
                allKeys.push(key);
                allValues.push(dataToSend.value);
                allUpdateTimes.push(dataToSend.updateTime);
            }

            const gas = pythiaConfig.tokensToPush.length * 12500;
            await retry(pythiaContract.multiSet, [allAssets, allKeys, allValues, allUpdateTimes, {gasLimit: gas}]);

            const runEndDate = Math.round(Date.now()/1000);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'success',
                'lastEnd': runEndDate,
                'lastDuration': runEndDate - Math.round(start/1000)
            });
        } catch(error) {
            console.error(error);
            const errorMsg = `An exception occurred: ${error}`;
            console.log(errorMsg);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'error',
                'error': errorMsg
            });
        }

        const sleepTime = 60 * 60 * 1000 - (Date.now() - start);
        
        // reset cache
        slippageCache = {};
        if(sleepTime > 0) {
            console.log(`${fnName()}: sleeping ${roundTo(sleepTime/1000/60)} minutes`);
            await sleep(sleepTime);
        }
    }
}



/**
 * @param {{symbol: string; decimals: number; address: string;}} tokenConf 
 * @param {number} daysToAvg 
 * @param {number} startBlock 
 * @param {number} endBlock 
 * @returns 
 */
async function getUniv3Average(tokenConf, daysToAvg, startBlock, endBlock) {
    console.log(`${fnName()}[${tokenConf.symbol}]: start finding data for ${TARGET_SLIPPAGE_BPS}bps slippage since block ${startBlock}`);
    const avgResult = getCachedAverageLiquidityForBlockInterval(DATA_DIR, tokenConf.symbol, 'USDC',  startBlock, endBlock);
    let avgLiquidityForTargetSlippage = avgResult.slippageMapAvg[TARGET_SLIPPAGE_BPS];
    console.log(`${fnName()}[${tokenConf.symbol}]: Computed average liquidity for ${TARGET_SLIPPAGE_BPS}bps slippage: ${avgLiquidityForTargetSlippage}`);
    
    // add volumes from WBTC and WETH pivots
    for(const pivot of ['WBTC', 'WETH']) {
        if(tokenConf.symbol == pivot) {
            continue;
        }

        const segment1AvgResult = getCachedAverageLiquidityForBlockInterval(DATA_DIR, tokenConf.symbol, pivot,  startBlock, endBlock);
        if(!segment1AvgResult) {
            console.log(`Could not find data for ${tokenConf.symbol}->${pivot}`);
            continue;
        }
        const segment2AvgResult = getCachedAverageLiquidityForBlockInterval(DATA_DIR, pivot, 'USDC',  startBlock, endBlock);
        if(!segment2AvgResult) {
            console.log(`Could not find data for ${pivot}->USDC`);
            continue;
        }
        const aggregVolume = computeAggregatedVolumeFromPivot(segment1AvgResult.slippageMapAvg, segment1AvgResult.averagePrice, segment2AvgResult.slippageMapAvg, TARGET_SLIPPAGE_BPS);
        console.log(`adding aggreg volume ${aggregVolume} from route ${tokenConf.symbol}->${pivot}->USDC for slippage ${TARGET_SLIPPAGE_BPS} bps`);
        avgLiquidityForTargetSlippage += aggregVolume;
        console.log(`new aggreg volume for ${tokenConf.symbol}->USDC: ${avgLiquidityForTargetSlippage} for slippage ${TARGET_SLIPPAGE_BPS} bps`);
    }

    // change the computed avg value to a BigNumber 
    // first round to 6 decimals: 6 being the minimum decimals for all the known tokens
    const roundedLiquidity = roundTo(avgLiquidityForTargetSlippage, 6);
    console.log(`${fnName()}[${tokenConf.symbol}]: roundedLiquidity: ${roundedLiquidity}`);
    const liquidityInWei = (new BigNumber(roundedLiquidity)).times((new BigNumber(10)).pow(tokenConf.decimals));
    console.log(`${fnName()}[${tokenConf.symbol}]: liquidityInWei: ${liquidityInWei.toString(10)}`);


    // return the computed value
    return {
        asset: tokenConf.address,
        value: ethers.BigNumber.from(liquidityInWei.toString(10)),
        updateTime: Math.round(Date.now()/1000), // timestamp in sec
    };
}

function getCachedAverageLiquidityForBlockInterval(DATA_DIR, base, quote,  startBlock, endBlock) {

    if(!slippageCache[base]) {
        slippageCache[base] = {};
    }

    if(!slippageCache[base][quote]){
        console.log(`loading ${base}->${quote} from files`);
        slippageCache[base][quote] = getAverageLiquidityForBlockInterval(DATA_DIR, base, quote,  startBlock, endBlock);
    } else {
        console.log(`using cache for ${base}->${quote}`);
    }

    return slippageCache[base][quote];
}

async function PythiaSender() {
    // number of days to avg is passed in the args
    const daysToAvg = Number(process.argv[2]);
    if(!daysToAvg) {
        throw new Error('Need to have a valid number as first command argument for daysToAvg');
    }

    await SendToPythia(daysToAvg);
}

PythiaSender();