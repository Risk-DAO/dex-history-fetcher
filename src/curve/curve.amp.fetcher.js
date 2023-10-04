
const dotenv = require('dotenv');
dotenv.config();
const RPC_URL = process.env.RPC_URL;
const { ethers } = require('ethers');
const { GetContractCreationBlockNumber } = require('../utils/web3.utils');
const curveConf = require('./curve.config');
const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);


// async function fetchRampA(pool, toBlock) {
//     const fromBlock = await GetContractCreationBlockNumber(web3Provider, pool);
//     const poolContract = new ethers.Contract(pool, curvePoolABI, web3Provider);
//     for (let i = fromBlock; i < toBlock; i += 200000) {
//         let events = await poolContract.queryFilter('RampA', i, (i+200000));
//         console.log('events', events[0]?.args['old_A'].toString());
//     }

// }

// async function fetchRampA(pool, toBlock) {
//     const fromBlock = await GetContractCreationBlockNumber(web3Provider, pool);
//     const poolContract = new ethers.Contract(pool, newParamsABI, web3Provider);
//     for (let i = fromBlock; i < toBlock; i += 200000) {
//         let events = await poolContract.queryFilter('NewParameters', i, (i+200000));
//         console.log('events', events[0]?.args['A'].toString());
//     }
// }

async function fetchRampA(pool, toBlock) {
    const fromBlock = await GetContractCreationBlockNumber(web3Provider, pool);
    const poolContract = new ethers.Contract(pool, curveConf.curvePoolAbi, web3Provider);
    for (let i = fromBlock; i < toBlock; i += 200000) {
        let events = await poolContract.queryFilter('RampA', i, (i+200000));
        console.log('found ', events.length, ' events');
        console.log('value', events[0]?.args['old_A'].toString());
    }
}



fetchRampA('0xed279fdd11ca84beef15af5d39bb4d4bee23f0ca', 16627596);