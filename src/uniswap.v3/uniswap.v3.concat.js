const path = require('path');
const fs = require('fs');
const { fnName, readLastLine } = require('../utils/utils');
const { getAvailableUniswapV3, getUniV3DataforBlockInterval } = require('./uniswap.v3.utils');

const DATA_DIR = process.cwd() + '/data';


async function createUnifiedFile(endBlock) {
    const available = getAvailableUniswapV3(DATA_DIR);

    for(const base of Object.keys(available)) {
        for(const quote of available[base]) {
            await createUnifiedFileForPair(endBlock, base, quote);
        }
    }
}

async function createUnifiedFileForPair(endBlock, fromSymbol, toSymbol) {
    console.log(`${fnName()}: create/append for ${fromSymbol} ${toSymbol}`);
    const unifiedFilename = `${fromSymbol}-${toSymbol}-unified-data.csv`;
    const unifiedFullFilename = path.join(DATA_DIR, 'precomputed', 'uniswapv3', unifiedFilename);
    let sinceBlock = 0;
    if(!fs.existsSync(unifiedFullFilename)) {
        fs.writeFileSync(unifiedFullFilename, 'blocknumber,price,slippagemap\n');
    } else {
        const lastLine = await readLastLine(unifiedFullFilename);
        sinceBlock = Number(lastLine.split(',')[0]) + 1;
        if(isNaN(sinceBlock)) {
            sinceBlock = 0;
        }
    }

    const allData = getUniV3DataforBlockInterval(DATA_DIR, fromSymbol, toSymbol, sinceBlock, endBlock);
    const toWrite = [];
    for(const [blockNumber, data] of Object.entries(allData)) {
        if(blockNumber < sinceBlock) {
            continue;
        }
        if(blockNumber > endBlock) {
            break;
        }

        toWrite.push(`${blockNumber},${data.price},${JSON.stringify(data.slippageMap)}\n`);

    }

    if(toWrite.length == 0) {
        console.log(`${fnName()}: nothing to add to file`);
    } else {
        fs.appendFileSync(unifiedFullFilename, toWrite.join(''));
    }
}

createUnifiedFile(18000000);