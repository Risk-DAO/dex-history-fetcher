const { getAverageLiquidity } = require('../src/data.interface/data.interface');

async function test() {
    const avgLiquidityUni = getAverageLiquidity('sushiswapv2', 'COMP', 'UNI', 17000000, 18000000);
    console.log(avgLiquidityUni);
    const avgLiquidity = getAverageLiquidity('sushiswapv2', 'COMP', 'USDC', 17000000, 18000000);
    console.log(avgLiquidity);

    const avgLiquidity2 = getAverageLiquidity('sushiswapv2', 'COMP', 'WETH', 17000000, 18000000);
    console.log(avgLiquidity2);

    const avgLiquidity3 = getAverageLiquidity('sushiswapv2', 'COMP', 'WBTC', 17000000, 18000000);
    console.log(avgLiquidity3);
}

test();