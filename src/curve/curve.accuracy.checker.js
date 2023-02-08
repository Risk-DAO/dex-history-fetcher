const { ethers, BigNumber } = require('ethers');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();
const RPC_URL = process.env.RPC_URL;
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);




async function main(historyFileName) {
    const numberOfTests = 1000;
    let testInterval = 0;
    let fileContent = undefined;
    let testCount = 0;
    let accuracy = 0;
    if (fs.existsSync(historyFileName)) {
        fileContent = fs.readFileSync(historyFileName, 'utf-8').split('\n');
        testInterval = Math.floor(fileContent.length / (numberOfTests));
        if (testInterval === 0) {
            testInterval = 1;
        }
    }
    else {
        console.log('could not open file');
    }

    if (!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }
    const threePoolAddr = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7';
    const p = '0x' + '1'.padStart(64, '0');
    const pKeccak = ethers.utils.keccak256(p);
    const bnPKeccak = BigNumber.from(pKeccak);
    for (let y = 1; y < fileContent.length; y += testInterval) {
        testCount += 1;
        const testResults = [];
        const line = fileContent[y].split(',');
        const blockNumber = Number(line[0]);
        console.log('line', line);
        console.log('blocknumber', blockNumber);
        for (let i = 0; i < 3; i++) {
            const r = await web3Provider.getStorageAt(threePoolAddr, bnPKeccak.add(i), blockNumber);
            const b = BigNumber.from(r);
            testResults.push(b);
            console.log(i, ':', b.toString());
        }
        if (line[1] === testResults[0].toString()
            && line[2] === testResults[1].toString()
            && line[3] === testResults[2].toString()) { accuracy += 1; }
        else {
            if (!fs.existsSync('debug.csv')) {
                let tokenHeaders = 'block, token1, token2, token3';
                fs.writeFileSync('debug.csv', `${tokenHeaders}\n`);
            }
            else{
                fs.appendFileSync('debug.csv', line + '\n');
            }
        }
        console.log('file accuracy:', (accuracy / testCount) * 100, '%');
        console.log('accurate count:', accuracy);
        console.log('testCount:', testCount);
        console.log('----------------------------');
    }
    console.log('Final file accuracy:', accuracy / testCount, '%');
}

main('./src/data/3Pool_0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7_curve.csv');