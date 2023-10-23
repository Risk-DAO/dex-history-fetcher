const { ethers } = require('ethers');
const { getLiquidity, getVolatility } = require('../src/data.interface/data.interface');
const { roundTo } = require('../src/utils/utils');
const { getBlocknumberForTimestamp } = require('../src/utils/web3.utils');

async function testNewBaseQuote() {

    const platform = process.argv[2] || 'uniswapv3';
    const base = process.argv[3] || 'WETH';
    const quote = process.argv[4] || 'USDC';


    const daysAgo = Math.round(Date.now()/1000) - 30 * 24 * 60 * 60;
    const daysAgoAgo = Math.round(Date.now()/1000) - 60 * 24 * 60 * 60;
    const endBlock =  await getBlocknumberForTimestamp(daysAgo);
    const startBlock =  await getBlocknumberForTimestamp(daysAgoAgo);
    const volatility = getVolatility(platform, base, quote, startBlock, endBlock, 30);
    console.log({volatility});
    // console.log({platform, base, quote});
    // const d = getLiquidity(platform, base, quote, 17_000_000, 18_000_000, false, 100000);
    // const point = d[18000000];
    // // console.log(point);
    // console.log('base price', point.price);
    // if(point.slippageMap[2000].base) {
    //     console.log('base amount 20%:', point.slippageMap[2000].base);
    //     console.log('quote amount 20%:', point.slippageMap[2000].quote);
    //     const avgPrice = point.slippageMap[2000].quote / point.slippageMap[2000].base;
    //     console.log('avg price 20%:', avgPrice);
    //     console.log('avg slippage:', roundTo(100*(1 - (avgPrice/point.price)), 2) , '%');
    // } else {
    //     console.log(point.slippageMap[2000]);
    // }
}

testNewBaseQuote();