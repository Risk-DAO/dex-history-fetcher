const { createUnifiedFileForPair } = require('../src/curve/curve.unified.generator');

async function runCurveUnifiedForPair() {
    await createUnifiedFileForPair(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
    // createUnifiedFileForPair(18291464, 'USDT', 'WETH', 'tricryptoUSDTPool');
}

runCurveUnifiedForPair();