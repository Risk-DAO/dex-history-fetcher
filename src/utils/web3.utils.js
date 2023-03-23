const axios = require('axios');
const dotenv = require('dotenv');
const { retry, fnName } = require('./utils');
dotenv.config();

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken';

/**
 * 
 * @param {ethers.providers.BaseProvider} web3Provider 
 * @param {string} contractAddress 
 * @returns 
 */
async function GetContractCreationBlockNumber(web3Provider, contractAddress) {
    console.log(`${fnName()}: fetching data for contract ${contractAddress}`);
    // call etherscan to get the tx receipt of contract creation
    const etherscanUrl = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${ETHERSCAN_API_KEY}`;
    const etherscanResponse = await retry(axios.get, [etherscanUrl]);

    const receipt = await web3Provider.getTransactionReceipt(etherscanResponse.data.result[0].txHash);
    // console.log(receipt);
    console.log(`${fnName()}: returning blocknumber: ${receipt.blockNumber}`);
    return receipt.blockNumber;
}

async function getBlocknumberForTimestamp(timestamp) {
    const defiLamaResp = await axios.get(`https://coins.llama.fi/block/ethereum/${timestamp}`);
    const blockNumber = defiLamaResp.data.height;
    console.log(`${fnName()}: at timestamp ${timestamp}, block: ${blockNumber}`);
    return blockNumber;
}

module.exports = { GetContractCreationBlockNumber, getBlocknumberForTimestamp };