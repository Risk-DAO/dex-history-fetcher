const { getLiquidity } = require('../src/data.interface/data.interface');
const { roundTo } = require('../src/utils/utils');

async function testNewBaseQuote() {

    const platform = process.argv[2] || 'uniswapv3';
    const base = process.argv[3] || 'WETH';
    const quote = process.argv[4] || 'USDC';

    console.log({platform, base, quote});
    const d = getLiquidity(platform, base, quote, 17_000_000, 18_000_000, true, 100000);
    const point = d[18000000];
    // console.log(point);
    console.log('base price', point.price);
    if(point.slippageMap[2000].base) {
        console.log('base amount 20%:', point.slippageMap[2000].base);
        console.log('quote amount 20%:', point.slippageMap[2000].quote);
        const avgPrice = point.slippageMap[2000].quote / point.slippageMap[2000].base;
        console.log('avg price 20%:', avgPrice);
        console.log('avg slippage:', roundTo(100*(1 - (avgPrice/point.price)), 2) , '%');
    } else {
        console.log(point.slippageMap[2000]);
    }
}

testNewBaseQuote();