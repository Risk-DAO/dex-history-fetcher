// this is just for debugging

const { ethers } = require('ethers');
const { getBlocknumberForTimestamp } = require('../../utils/web3.utils');
const { getAverageLiquidityForInterval, getParkinsonVolatilityForInterval } = require('../data.interface');

async function testVolatility() {
    const daysToAvg = 180;
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const endBlock = await web3Provider.getBlockNumber();
    const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (daysToAvg * 24 * 60 * 60));
    const base = 'DAI';
    const quote = 'USDC';
    const allVol = getParkinsonVolatilityForInterval(base, quote, startBlock, endBlock, undefined, daysToAvg);
    const univ2Vol = getParkinsonVolatilityForInterval(base, quote, startBlock, endBlock, ['uniswapv2'], daysToAvg);
    const univ3Vol = getParkinsonVolatilityForInterval(base, quote, startBlock, endBlock, ['uniswapv3'], daysToAvg);
    const curve = getParkinsonVolatilityForInterval(base, quote, startBlock, endBlock, ['curve'], daysToAvg);

    console.log({allVol}, {univ2Vol}, {univ3Vol}, {curve});
}
async function testLiquidity() {
    const daysToAvg = 30;
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const endBlock = await web3Provider.getBlockNumber();
    const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (daysToAvg * 24 * 60 * 60));
    const base = 'WETH';
    const quote = 'USDC';
    // const slippageMaps = getSlippageMapForInterval(base, quote, startBlock, endBlock, undefined, false);
    // const univ2slippageMaps = getSlippageMapForInterval(base, quote, startBlock, endBlock, undefined, true);
    // console.log(univ2slippageMaps);
    // const univ3slippageMaps = getSlippageMapForInterval(base, quote, startBlock, endBlock, ['uniswapv3'], false);
    // const univ3slippageMapsCombined = getSlippageMapForInterval(base, quote, startBlock, endBlock, ['uniswapv3'], true);
    // // const curveSlippageMaps = getSlippageMapForInterval(base, quote, startBlock, endBlock, ['curve'], false);
    // console.log(JSON.stringify(univ3slippageMaps[startBlock]));
    // console.log('-----------------------');
    // console.log(JSON.stringify(univ3slippageMapsCombined[startBlock]));

    const result = getAverageLiquidityForInterval(base, quote, startBlock, endBlock, ['uniswapv3'], false);
    console.log(result);
    // const result = getAverageLiquidityForInterval(base, quote, startBlock, endBlock, ['uniswapv3'], false);
    // console.log(result[500]);
    // const resultJumps = getAverageLiquidityForInterval(base, quote, startBlock, endBlock, ['uniswapv3'], true);
    // console.log(resultJumps[500]);
    // const resultJumpsMulti = getAverageLiquidityForInterval(base, quote, startBlock, endBlock, ['uniswapv2','uniswapv3'], true);
    // console.log(resultJumpsMulti[500]);

    // const avg = getSlippageMapForInterval('WETH', 'USDC', 17878273, 17928316, ['uniswapv3'], true);
    // console.log(avg);
    // console.log(slippageMaps[startBlock], univ2slippageMaps[startBlock], univ3slippageMaps[startBlock], curveSlippageMaps[startBlock]);
}

testVolatility();
testLiquidity();