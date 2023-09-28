const { getLiquidity, getVolatility, getLiquidityAllPlatforms } = require('../src/data.interface/data.interface');
const { getBlankUnifiedData } = require('../src/data.interface/internal/data.interface.utils');
const { PLATFORMS } = require('../src/utils/constants');
const { getBlocknumberForTimestamp } = require('../src/utils/web3.utils');
const ethers = require('ethers');
const fs = require('fs');
require('dotenv').config();


async function outputData() {
    const RPC_URL = process.env.RPC_URL;
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
    const currentBlock = await web3Provider.getBlockNumber();
    const block30DaysAgo = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (30 * 24 * 60 * 60)); 


    fs.rmSync('data.csv', {force: true});
    for(const platform of PLATFORMS) {
        generateData(platform, 'stETH', 'WETH', currentBlock, block30DaysAgo);
    }

    generateDataAllPlatforms('stETH', 'WETH', currentBlock);
    for(const platform of PLATFORMS) {
        generateData(platform, 'USDC', 'WETH', currentBlock, block30DaysAgo);
    }

    generateDataAllPlatforms('USDC', 'WETH', currentBlock);
}

outputData();

function generateData(platform, base, quote, currentBlock, block30DaysAgo) {
    let liquidity = getLiquidity(platform, base, quote, currentBlock - 300, currentBlock);
    if(!liquidity) {
        liquidity= getBlankUnifiedData(currentBlock - 300, currentBlock)
    }

    const parkinsonVol = getVolatility(platform, base, quote, block30DaysAgo, currentBlock, 30);
    const lastBlock = Object.keys(liquidity).at(-1);
    const lastData = liquidity[lastBlock];
    // console.log(lastData);
    const headers = [];
    const data = [];
    headers.push('platform');
    data.push(platform);

    headers.push('base');
    headers.push('quote');
    data.push(base);
    data.push(quote);

    headers.push('volatility');
    data.push(parkinsonVol);

    for (let i = 1; i <= 20; i++) {
        headers.push(`liquidity for ${i}% slippage`);
        if(! lastData.slippageMap) {
            data.push(0);
        } else {
            const dataForSlippage = lastData.slippageMap[i * 100];
            data.push(dataForSlippage);
        }
    }

    if (!fs.existsSync('data.csv')) {
        fs.writeFileSync('data.csv', headers.join(',') + '\n');
    }
    fs.appendFileSync('data.csv', data.join(',') + '\n');
}

function generateDataAllPlatforms(base, quote, currentBlock) {
    const liquidity = getLiquidityAllPlatforms(base, quote, currentBlock - 300, currentBlock);

    const lastBlock = Object.keys(liquidity).at(-1);
    const lastData = liquidity[lastBlock];
    // console.log(lastData);
    const headers = [];
    const data = [];
    headers.push('platform');
    data.push('all');

    headers.push('base');
    headers.push('quote');
    data.push(base);
    data.push(quote);

    headers.push('volatility');
    data.push(0);

    for (let i = 1; i <= 20; i++) {
        headers.push(`liquidity for ${i}% slippage`);
        if(! lastData.slippageMap) {
            data.push(0);
        } else {
            const dataForSlippage = lastData.slippageMap[i * 100];
            data.push(dataForSlippage);
        }
    }

    if (!fs.existsSync('data.csv')) {
        fs.writeFileSync('data.csv', headers.join(',') + '\n');
    }
    fs.appendFileSync('data.csv', data.join(',') + '\n');
}
