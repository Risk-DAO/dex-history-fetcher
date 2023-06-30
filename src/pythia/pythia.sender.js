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

const DATA_DIR = process.cwd() + '/data';
const TARGET_SLIPPAGE_BPS = 500;
const MONITORING_NAME = 'Pythia Sender';

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
            const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
            const signer = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, new ethers.providers.StaticJsonRpcProvider(process.env.PYTHIA_RPC_URL));
            const pythiaContract = new Contract(pythiaConfig.pythiaAddress, pythiaConfig.pythiaAbi, signer);

            const allAssets = [];
            const allKeys = [];
            const allValues = [];
            
            // find block for 'daysToAvg' days ago
            const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now()/1000) - (daysToAvg * 24 * 60 * 60));
            console.log(`${fnName()}: Will avg liquidity since block ${startBlock}`);
            /*library.externalFunction(param => this.doSomething(param));*/
            const endBlock = await retry((() => web3Provider.getBlockNumber()), []);

            for(const tokenSymbol of pythiaConfig.tokensToPush) {
                // get config 
                const tokenConf = getConfTokenBySymbol(tokenSymbol);
                console.log(`${fnName()}[${tokenSymbol}]: start working on token ${tokenConf.symbol} with address ${tokenConf.address}`);
                
                const dataToSend = await getUniv3Average(tokenConf, daysToAvg, startBlock, endBlock);
                console.log(`${fnName()}[${tokenSymbol}]: data to send:`, dataToSend);
                allAssets.push(dataToSend.asset);
                allKeys.push(dataToSend.key);
                allValues.push(dataToSend.value);
            }

            await retry(pythiaContract.multiSet, [allAssets, allKeys, allValues, {gasLimit: 100000}]);

            const runEndDate = Math.round(Date.now()/1000);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'success',
                'lastEnd': runEndDate,
                'lastDuration': runEndDate - Math.round(start/1000)
            });
        } catch(error) {
            const errorMsg = `An exception occurred: ${error}`;
            console.log(errorMsg);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'error',
                'error': errorMsg
            });
        }

        const sleepTime = 60 * 60 * 1000 - (Date.now() - start);
        if(sleepTime > 0) {
            console.log(`${fnName()}: sleeping ${roundTo(sleepTime/1000/60)} minutes`);
            await sleep(sleepTime);
        }
    }
}


/**
 * Read the precomputed value from data/precomputed/uniswapv3/averages-{daysToAvg}d.json
 * @param {{symbol: string; decimals: number; address: string;}} tokenConf 
 * @param {number} daysToAvg 
 * @param {number} startBlock 
 * @param {number} endBlock 
 * @returns 
 */
async function getUniv3Average(tokenConf, daysToAvg, startBlock, endBlock) {

    console.log(`${fnName()}[${tokenConf.symbol}]: start finding data for ${TARGET_SLIPPAGE_BPS}bps slippage since block ${startBlock}`);
    const avgResult = getAverageLiquidityForBlockInterval(DATA_DIR, tokenConf.symbol, 'USDC',  startBlock, endBlock);
    const avgLiquidityForTargetSlippage = avgResult.slippageMapAvg[TARGET_SLIPPAGE_BPS];
    console.log(`${fnName()}[${tokenConf.symbol}]: Computed average liquidity for ${TARGET_SLIPPAGE_BPS}bps slippage: ${avgLiquidityForTargetSlippage}`);

    // change the computed avg value to a BigNumber 
    // first round to 6 decimals: 6 being the minimum decimals for all the known tokens
    const roundedLiquidity = roundTo(avgLiquidityForTargetSlippage, 6);
    console.log(`${fnName()}[${tokenConf.symbol}]: roundedLiquidity: ${roundedLiquidity}`);
    const liquidityInWei = (new BigNumber(roundedLiquidity)).times((new BigNumber(10)).pow(tokenConf.decimals));
    console.log(`${fnName()}[${tokenConf.symbol}]: liquidityInWei: ${liquidityInWei.toString(10)}`);

    // return the computed value
    return {
        asset: tokenConf.address,
        key: utils.keccak256(utils.toUtf8Bytes(`avg ${daysToAvg} days uni v3 liquidity`)),
        value: ethers.BigNumber.from(liquidityInWei.toString(10))
    };
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