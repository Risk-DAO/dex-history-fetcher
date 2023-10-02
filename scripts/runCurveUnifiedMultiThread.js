const { exec } = require('child_process');
const { getAvailableCurve } = require('../src/curve/curve.utils');
const { sleep } = require('../src/utils/utils');
const { ethers } = require('ethers');

async function runCurveUnifiedMultiThread() {
    const available = getAvailableCurve('./data');

    // get most recent block by rpc
    const web3Provider = new ethers.providers.StaticJsonRpcProvider('https://eth.llamarpc.com');
    const currentBlock = await web3Provider.getBlockNumber();
    for(const base of Object.keys(available)) {
        for(const quote of Object.keys(available[base])) {
            
            for(const pool of Object.keys(available[base][quote])) {
                const cmd = `node ./scripts/runCurveUnifiedForPair.js ${currentBlock} ${base} ${quote} ${pool}`;
                console.log(`starting cmd: ${cmd}`);
                exec(cmd);
                await sleep(10000);
            }
        }
    }
}

runCurveUnifiedMultiThread();