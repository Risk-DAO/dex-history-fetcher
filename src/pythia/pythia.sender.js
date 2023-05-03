const { ethers, utils, Contract } = require('ethers');
const BigNumber = require('bignumber.js');
const pythiaConfig = require('./pythia.config');
const dotenv = require('dotenv');
const { fnName, roundTo } = require('../utils/utils');
const { getConfTokenBySymbol } = require('../utils/token.utils');
dotenv.config();
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.cwd() + '/data';
const TARGET_SLIPPAGE = 5;

async function SendToPythia(daysToAvg) {

    if(!process.env.ETH_PRIVATE_KEY) {
        console.log('Could not find ETH_PRIVATE_KEY env variable');
    }
    
    // using PYTHIA_RPC_URL because for now the contract is on sepolia
    if(!process.env.PYTHIA_RPC_URL) {
        throw new Error('Could not find PYTHIA_RPC_URL env variable');
    }
    
    try {
        const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.PYTHIA_RPC_URL);
        const signer = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, web3Provider);
        const pythiaContract = new Contract(pythiaConfig.pythiaAddress, pythiaConfig.pythiaAbi, signer);

        const allAssets = [];
        const allKeys = [];
        const allValues = [];
        for(const tokenSymbol of pythiaConfig.tokensToPush) {
            // get config 
            const tokenConf = getConfTokenBySymbol(tokenSymbol);
            console.log(`${fnName()}[${tokenSymbol}]: start working on token ${tokenConf.symbol} with address ${tokenConf.address}`);
            
            const dataToSend = getUniv3Average(tokenConf, daysToAvg);
            console.log(`${fnName()}[${tokenSymbol}]: data to send:`, dataToSend);
            allAssets.push(dataToSend.asset);
            allKeys.push(dataToSend.key);
            allValues.push(dataToSend.value);
        }

        await pythiaContract.multiSet(allAssets, allKeys, allValues);

    } catch(e) {
        console.error(e);
    }
}


/**
 * Read the precomputed value from data/precomputed/uniswapv3/averages-{daysToAvg}d.json
 * @param {{symbol: string; decimals: number; address: string;}} tokenConf 
 * @param {number} daysToAvg 
 * @returns 
 */
function getUniv3Average(tokenConf, daysToAvg) {

    console.log(`${fnName()}[${tokenConf.symbol}]: start finding data for ${TARGET_SLIPPAGE}% slippage`);
    // read average data file
    const filePath = path.join(DATA_DIR, 'precomputed', 'uniswapv3', `averages-${daysToAvg}d.json`);
    const averagesData = JSON.parse(fs.readFileSync(filePath));

    // find the correct value against USDC
    const liquidityInfo = averagesData[tokenConf.symbol]['USDC'];
    if(!liquidityInfo) {
        throw new Error(`Could not find data for ${tokenConf.symbol}/USDC in ${filePath}`);
    }

    const selectedAverageLiquidity = liquidityInfo.avgLiquidity[TARGET_SLIPPAGE];
    console.log(`${fnName()}[${tokenConf.symbol}]: liquidity: ${selectedAverageLiquidity}`);
    const roundedLiquidity = roundTo(selectedAverageLiquidity, 6);
    console.log(`${fnName()}[${tokenConf.symbol}]: roundedLiquidity: ${roundedLiquidity}`);
    const liquidityInWei = (new BigNumber(roundedLiquidity)).times((new BigNumber(10)).pow(tokenConf.decimals));
    console.log(`${fnName()}[${tokenConf.symbol}]: liquidityInWei: ${liquidityInWei.toString(10)}`);
    return {
        asset: tokenConf.address,
        key: utils.keccak256(utils.toUtf8Bytes(`avg ${daysToAvg} days uni v3 liquidity`)),
        value: ethers.BigNumber.from(liquidityInWei.toString(10))
    };
}

// async function test() {
//     // number of days to avg is passed in the args
//     const daysToAvg = Number(process.argv[2]);
//     if(!daysToAvg) {
//         throw new Error('Need to have a valid number as first command argument for daysToAvg');
//     }

//     await SendToPythia(daysToAvg);
// }

// test();

module.exports = {SendToPythia};