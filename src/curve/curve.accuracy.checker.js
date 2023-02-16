const { ethers, BigNumber } = require('ethers');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();
const RPC_URL = process.env.RPC_URL;
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);

async function FetchTokenBalance(token, blocknumber) {

    const tokenContract = token;
    const _3poolAddress = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7';
    // ABI
    let abi = [
        'function balanceOf(address account)'
    ];

    // Create function call data -- eth_call
    let iface = new ethers.utils.Interface(abi);
    let data = iface.encodeFunctionData('balanceOf', [_3poolAddress]);

    // Get balance at a particular block -- usage of eth_call
    let balance = await web3Provider.call({
        to: tokenContract,
        data: data,
    }, blocknumber);

    const decoded = ethers.utils.defaultAbiCoder.decode(['uint256'], balance);
    return decoded.toString();
}


async function main(historyFileName) {
    const acceptableDeviation = 0.003;
    let consistency = true;
    const numberOfTests = 1000;
    let testInterval = 0;
    let fileContent = undefined;
    let testCount = 0;
    let accuracy = 0;
    let biggestDeviation = 0;
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
    for (let y = 2; y < fileContent.length; y += testInterval) {
        testCount += 1;
        const testResults = [];
        const line = fileContent[y].split(',');
        const blockNumber = Number(line[0]);

        for (let i = 0; i < 3; i++) {
            const r = await web3Provider.getStorageAt(threePoolAddr, bnPKeccak.add(i), blockNumber);
            const b = BigNumber.from(r);
            testResults.push(b);
        }

        ///checking if balanceOf gets the same result
        for (let i = 0; i < 3; i++) {
            if (i === 0) {
                const checked = await FetchTokenBalance('0x6B175474E89094C44Da98b954EedeAC495271d0F', blockNumber);
                if (checked !== line[(i+1)]) {
                    console.log('ERROR ==== BalanceOf =//= events');
                    consistency = false;
                }
            }
            if (i === 1) {
                const checked = await FetchTokenBalance('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', blockNumber);
                if (checked !== line[(i+1)]) {
                    console.log('ERROR ==== BalanceOf =//= events');
                    consistency = false;
                }
            }
            if (i === 2) {
                const checked = await FetchTokenBalance('0xdAC17F958D2ee523a2206206994597C13D831ec7', blockNumber);
                if (checked !== line[(i+1)]) {
                    console.log('ERROR ==== BalanceOf =//= events');
                    consistency = false;
                }
            }
        }

        const deviation = [];
        for (let i = 0; i < testResults.length; i++) {
            let divisor = 0;
            if (i === 0) {
                divisor = BigNumber.from(10).pow(18);
            }
            else {
                divisor = BigNumber.from(10).pow(16);
            }
            let toCheck = BigNumber.from(line[(i + 1)]).div(divisor);
            let control = (BigNumber.from(testResults[i])).div(divisor);
            toCheck = toCheck.toNumber();
            if (toCheck !== 0) {
                control = control.toNumber();
                const delta = toCheck - control;
                const calcDeviation = delta / toCheck;
                if (calcDeviation > biggestDeviation) {
                    biggestDeviation = calcDeviation;
                }
                deviation.push(calcDeviation);
            }
            else {
                deviation.push(0);
            }
        }

        if (deviation[0] < acceptableDeviation
            && deviation[1] < acceptableDeviation
            && deviation[2] < acceptableDeviation) { accuracy += 1; }
        else {
            if (!fs.existsSync('debug.csv')) {
                let tokenHeaders = 'block, token1, token2, token3';
                fs.writeFileSync('debug.csv', `${tokenHeaders}\n`);
                fs.appendFileSync('debug.csv', 'faulty line:' + '\n');
                fs.appendFileSync('debug.csv', line + '\n');
                fs.appendFileSync('debug.csv', 'expected line:' + '\n');
                fs.appendFileSync('debug.csv', `${blockNumber}, ${testResults[0]}, ${testResults[1]}, ${testResults[2]}` + '\n');
                fs.appendFileSync('debug.csv', '--------------------:' + '\n');
            }
            else {
                fs.appendFileSync('debug.csv', 'faulty line:' + '\n');
                fs.appendFileSync('debug.csv', line + '\n');
                fs.appendFileSync('debug.csv', 'expected line:' + '\n');
                fs.appendFileSync('debug.csv', `${blockNumber}, ${testResults[0]}, ${testResults[1]}, ${testResults[2]}` + '\n');
                fs.appendFileSync('debug.csv', '--------------------:' + '\n');

            }
        }
        console.log('----------------------------');
        console.log('test number', testCount, '/', numberOfTests);
        console.log('blocknumber', blockNumber);
        console.log('Max Deviation', biggestDeviation);
        console.log(`Blocks within acceptable deviation (${acceptableDeviation}):`, (accuracy / testCount) * 100, '%');
        console.log('accurate count:', accuracy);
        console.log('Step:', testInterval);
        console.log('events / balance consistency:', consistency);
        console.log('----------------------------');
    }
    console.log('accuracy:', 1 - biggestDeviation, '%');
}

main('./src/data/3Pool_0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7_curve.csv');