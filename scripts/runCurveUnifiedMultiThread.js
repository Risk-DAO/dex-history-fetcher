const { exec } = require('child_process');
const { getAvailableCurve } = require('../src/curve/curve.utils');
const { sleep } = require('../src/utils/utils');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../src/utils/constants');

async function runCurveUnifiedMultiThread() {
    const available = getAvailableCurve('./data');

    if(!fs.existsSync(path.join(DATA_DIR, 'precomputed', 'curve'))) {
        fs.mkdirSync(path.join(DATA_DIR, 'precomputed', 'curve'), {recursive: true});
    }
    // get most recent block by rpc
    const web3Provider = new ethers.providers.StaticJsonRpcProvider('https://eth.llamarpc.com');
    const currentBlock = await web3Provider.getBlockNumber();
    const allChilds = [];
    for(const base of Object.keys(available)) {
        for(const quote of Object.keys(available[base])) {
            
            for(const pool of Object.keys(available[base][quote])) {
                const cmd = `node ./scripts/runCurveUnifiedForPair.js ${currentBlock} ${base} ${quote} ${pool}`;
                // const cmd = `node ./scripts/runCurveUnifiedForPair.js ${currentBlock} ${base} ${quote} ${pool} > ${base}_${quote}_${pool}.log`;
                console.log(`starting cmd: ${cmd}`);
                const childProcess = exec(cmd);
                allChilds.push(childProcess);
                await sleep(500);
            }
        }
    }

    await sleep(5000);
    let mustWait = allChilds.filter(_ => _.exitCode == null).length > 0;
    while(mustWait) {
        await sleep(10000);
        const subProcessStillRunningCount = allChilds.filter(_ => _.exitCode == null).length;
        console.log(`runCurveUnifiedMultiThread: Waiting for all subProcess to end. ${subProcessStillRunningCount}/${allChilds.length} still running`);
        mustWait = subProcessStillRunningCount > 0;
    }
}

// runCurveUnifiedMultiThread();
module.exports = { runCurveUnifiedMultiThread };