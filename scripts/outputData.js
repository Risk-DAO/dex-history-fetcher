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
    const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (180 * 24 * 60 * 60)); 
    const blockLastYear = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (380 * 24 * 60 * 60)); 

    const bases = ['stETH', 'USDC'];

    for(const base of bases) {
        for(const platform of PLATFORMS) {
            generateLiquidityData(platform, base, 'WETH', startBlock, currentBlock);
        }

        generateDataAllPlatforms(base, 'WETH', startBlock, currentBlock);
        await generateVolatilyData(base, 'WETH', currentBlock);
    }
}

outputData();

async function generateVolatilyData(base, quote, currentBlock) {
    const spans = [7, 30, 180];

    const filename = `${base}-${quote}-volatilitydata.csv`;
    fs.writeFileSync(filename, 'platform,day,volatility\n');
    for(const span of spans) {
        const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (span * 24 * 60 * 60)); 
        for(const platform of PLATFORMS) {
            const volatility = getVolatility(platform, base, quote, startBlock, currentBlock, span);
            fs.appendFileSync(filename, `${platform},${span},${volatility || 'N/A'}\n`);
        }
    }
}

function generateLiquidityData(platform, base, quote, startBlock, currentBlock) {
    const liquidity = getLiquidity(platform, base, quote, startBlock, currentBlock);
    if(!liquidity) {
        return;
    }
    const filename = `${base}-${quote}-${platform}-liquidity.csv`;
    
    const headers = [];
    headers.push('platform');
    headers.push('base');
    headers.push('quote');
    headers.push('block');
    for (let i = 1; i <= 20; i++) {
        headers.push(`liquidity for ${i}% slippage`);
    }

    fs.writeFileSync(filename, headers.join(',') + '\n');

    for(const block of Object.keys(liquidity)) {
        const data = [];
        data.push(platform);
        data.push(base);
        data.push(quote);
        data.push(block);

        const liquidityDataAtBlock = liquidity[block];
        for (let i = 1; i <= 20; i++) {
            if(!liquidityDataAtBlock.slippageMap) {
                data.push(0);
            } else {
                const dataForSlippage = liquidityDataAtBlock.slippageMap[i * 100];
                data.push(dataForSlippage);
            }
        }

        fs.appendFileSync(filename, data.join(',') + '\n');
    }
}


function generateDataAllPlatforms(base, quote, startBlock, currentBlock) {
    const liquidity = getLiquidityAllPlatforms(base, quote, startBlock, currentBlock);
    if(!liquidity) {
        return;
    }
    const filename = `${base}-${quote}-all-platforms-liquidity.csv`;
    
    const headers = [];
    headers.push('platform');
    headers.push('base');
    headers.push('quote');
    headers.push('block');
    for (let i = 1; i <= 20; i++) {
        headers.push(`liquidity for ${i}% slippage`);
    }

    fs.writeFileSync(filename, headers.join(',') + '\n');

    for(const block of Object.keys(liquidity)) {
        const data = [];
        data.push('all');
        data.push(base);
        data.push(quote);
        data.push(block);

        const liquidityDataAtBlock = liquidity[block];
        for (let i = 1; i <= 20; i++) {
            if(!liquidityDataAtBlock.slippageMap) {
                data.push(0);
            } else {
                const dataForSlippage = liquidityDataAtBlock.slippageMap[i * 100];
                data.push(dataForSlippage);
            }
        }

        fs.appendFileSync(filename, data.join(',') + '\n');
    }
}

