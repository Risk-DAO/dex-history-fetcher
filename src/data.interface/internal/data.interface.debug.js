// this is just for debugging

const { ethers } = require('ethers');
const { getBlocknumberForTimestamp } = require('../../utils/web3.utils');
const { getLiquidity, getVolatility, getAverageLiquidity } = require('../data.interface');

async function testVolatility() {
    const daysToAvg = 365;
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const endBlock = await web3Provider.getBlockNumber();
    const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (daysToAvg * 24 * 60 * 60));
    const base = 'DAI';
    const quote = 'USDC';
    const univ2Vol = getVolatility('uniswapv2', base, quote, startBlock, endBlock, daysToAvg);
    const univ3Vol = getVolatility('uniswapv3', base, quote, startBlock, endBlock, daysToAvg);
    const curve = getVolatility('curve', base, quote, startBlock, endBlock, daysToAvg);

    console.log({univ2Vol}, {univ3Vol}, {curve});
}
async function testLiquidity() {
    const daysToAvg = 7;
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const endBlock = await web3Provider.getBlockNumber();
    const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (daysToAvg * 24 * 60 * 60));
    const base = 'WBTC';
    const quote = 'USDC';

    // const stepBlock = Math.round((endBlock-startBlock) / 50);
    const stepBlock = 50;

    // const liquidityUniv2 = getLiquidity('uniswapv2', base, quote, startBlock, endBlock, true, stepBlock);
    // const liquidityUniv3 = getLiquidity('uniswapv3', base, quote, startBlock, endBlock, true, stepBlock);
    // const liquidityCurve = getLiquidity('curve', base, quote, startBlock, endBlock, true, stepBlock);
    // const avgLiquidityUniv2 = getAverageLiquidity('uniswapv2', base, quote, startBlock, endBlock, true);
    // const avgLiquidityUniv3 = getAverageLiquidity('uniswapv3', base, quote, startBlock, endBlock, true);
    // const avgLiquidityCurve = getAverageLiquidity('curve', base, quote, startBlock, endBlock, true);

    const avgLiquidityUniv3 = getAverageLiquidity('uniswapv3', base, quote, startBlock, endBlock, true);
    console.log(avgLiquidityUniv3.avgSlippageMap[100],
        avgLiquidityUniv3.avgSlippageMap[500],
        avgLiquidityUniv3.avgSlippageMap[1000],
        avgLiquidityUniv3.avgSlippageMap[1500],
        avgLiquidityUniv3.avgSlippageMap[2000]);
        const avgLiquidityUniv3NoJump = getAverageLiquidity('uniswapv3', base, quote, startBlock, endBlock, false);
        console.log(avgLiquidityUniv3NoJump.avgSlippageMap[100],
            avgLiquidityUniv3NoJump.avgSlippageMap[500],
            avgLiquidityUniv3NoJump.avgSlippageMap[1000],
            avgLiquidityUniv3NoJump.avgSlippageMap[1500],
            avgLiquidityUniv3NoJump.avgSlippageMap[2000]);
    console.log('debug ended');
}

// testVolatility();
testLiquidity();