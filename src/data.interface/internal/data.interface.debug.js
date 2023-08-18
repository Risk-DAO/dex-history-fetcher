// this is just for debugging

const { ethers } = require('ethers');
const { getBlocknumberForTimestamp } = require('../../utils/web3.utils');
const { getLiquidity, getVolatility, getAverageLiquidity } = require('../data.interface');

async function testVolatility() {
    const daysToAvg = 180;
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const endBlock = await web3Provider.getBlockNumber();
    const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (daysToAvg * 24 * 60 * 60));
    const base = 'DAI';
    const quote = 'USDC';
    const allVol = getVolatility(base, quote, startBlock, endBlock, undefined, daysToAvg);
    const univ2Vol = getVolatility(base, quote, startBlock, endBlock, ['uniswapv2'], daysToAvg);
    const univ3Vol = getVolatility(base, quote, startBlock, endBlock, ['uniswapv3'], daysToAvg);
    const curve = getVolatility(base, quote, startBlock, endBlock, ['curve'], daysToAvg);

    console.log({allVol}, {univ2Vol}, {univ3Vol}, {curve});
}
async function testLiquidity() {
    const daysToAvg = 30;
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const endBlock = await web3Provider.getBlockNumber();
    const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (daysToAvg * 24 * 60 * 60));
    const base = 'WETH';
    const quote = 'USDC';

    const stepBlock = Math.round((endBlock-startBlock) / 50);

    // const liquidity = getLiquidity(base, quote, startBlock, endBlock, platforms, true, stepBlock);
    const avgLiquidityUniv2 = getAverageLiquidity('uniswapv2', base, quote, startBlock, endBlock, true);
    const avgLiquidityUniv3 = getAverageLiquidity('uniswapv3', base, quote, startBlock, endBlock, true);
    console.log(avgLiquidityUniv2);
}

// testVolatility();
testLiquidity();