const { getLiquidity } = require('../src/data.interface/data.interface');
const fs = require('fs');

async function generateLiquidityHistory() {
    const liquidity = getLiquidity('curve', 'stETH', 'WETH', 15544519, 18161717, false);

    const lines = [];
    for(const [block, data] of Object.entries(liquidity)) {

        lines.push(`${block},${data.slippageMap[500]}\n`);
    }

    fs.writeFileSync('stETH_liquidity_500bps_slippage.csv', lines.join(''));
}

generateLiquidityHistory();