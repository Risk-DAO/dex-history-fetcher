const { ethers, BigNumber } = require('ethers');
const dotenv = require('dotenv');
dotenv.config();
const RPC_URL = process.env.RPC_URL;

async function main() {
    if(!RPC_URL) {
        throw new Error('Could not find RPC_URL env variable');
    }
    const threePoolAddr = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7';
    const p = '0x' + '1'.padStart(64, '0');
    const pKeccak = ethers.utils.keccak256(p);
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);

    const bnPKeccak = BigNumber.from(pKeccak);
    console.log(bnPKeccak.toString());
    for(let i = 0; i < 3; i++) {
        const r = await web3Provider.getStorageAt(threePoolAddr, bnPKeccak.add(i), 'latest');
        const b = BigNumber.from(r);
        console.log(i, ':', b.toString());
    }
}

main();