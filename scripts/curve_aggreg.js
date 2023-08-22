const { getAverageLiquidity, getLiquidity } = require('../src/data.interface/data.interface');

async function test() {
    const lqty = getLiquidity('curve', 'DAI', 'USDC', 17963689, 17970740, true, 141);
    console.log(lqty);
}

test();