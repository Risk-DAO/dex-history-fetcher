const path = require('path');
const fs = require('fs');
const { fnName, readLastLine, sleep } = require('../utils/utils');
const { getConfTokenBySymbol, normalize } = require('../utils/token.utils');
const { getAvailableCurve, getCurveDataforBlockInterval, computePriceAndSlippageMapForReserveValue } = require('./curve.utils');
const { getBlocknumberForTimestamp } = require('../utils/web3.utils');

const DATA_DIR = process.cwd() + '/data';

// this can be very long if done from the begining. 
async function generateUnifiedFileCurve(endBlock) {
    const available = getAvailableCurve(DATA_DIR);

    const threads = [];
    for(const base of Object.keys(available)) {
        for(const quote of Object.keys(available[base])) {
            await createUnifiedFileForPair(endBlock, base, quote, Object.keys(available[base][quote]));
        }
    }

    await Promise.all(threads);
}

async function createUnifiedFileForPair(endBlock, fromSymbol, toSymbol, pools) {
    console.log(`${fnName()}: create/append for ${fromSymbol} ${toSymbol} for pools ${pools}`);
    const unifiedFilename = `${fromSymbol}-${toSymbol}-unified-data.csv`;
    const unifiedFullFilename = path.join(DATA_DIR, 'precomputed', 'curve', unifiedFilename);
    let sinceBlock = 0;
    let toWrite = [];
    if(!fs.existsSync(unifiedFullFilename)) {
        fs.writeFileSync(unifiedFullFilename, 'blocknumber,price,slippagemap\n');
    } else {
        const lastLine = await readLastLine(unifiedFullFilename);
        sinceBlock = Number(lastLine.split(',')[0]) + 1;
        if(isNaN(sinceBlock)) {
            sinceBlock = 0;
        }
    }

    if(sinceBlock == 0) {
        const startDate = Math.round(Date.now()/1000) - 365 * 24 * 60 * 60;
        // get the blocknumber for this date
        sinceBlock =  await getBlocknumberForTimestamp(startDate);
    }

    console.log(`${fnName()}: getting data since ${sinceBlock} to ${endBlock}`);
    const poolData = [];
    const poolBlockNumbers = {};
    let mainPool = pools[0];
    for(const poolName of pools) {
        poolData[poolName] = getCurveDataforBlockInterval(DATA_DIR,poolName, sinceBlock, endBlock);
        poolBlockNumbers[poolName] = Object.keys(poolData[poolName].reserveValues).map(_ => Number(_));

        // the main pool is the one with the more data in it (the more trades)
        if(poolBlockNumbers[poolName].length > poolBlockNumbers[mainPool]) {
            mainPool = poolName;
        }
    }

    console.log(`selected main pool: ${mainPool}`);
    let lastSavedBlock = sinceBlock-1;
    for(const blockNumber of poolBlockNumbers[mainPool]) {
        // only save every 50 blocks
        if(lastSavedBlock + 50 > blockNumber) {
            continue;
        }

        // compute price from mainpool
        const mainDataForBlock = poolData[mainPool].reserveValues[blockNumber];
        const mainReserves = [];
        for(const poolToken of poolData[mainPool].poolTokens) {
            mainReserves.push(poolData[mainPool].reserveValues[blockNumber][poolToken]);
        }
        const mainPriceAndSlippage = computePriceAndSlippageMapForReserveValue(fromSymbol,
            toSymbol,
            poolData[mainPool].poolTokens,
            mainDataForBlock.ampFactor,
            mainDataForBlock.lpSupply,
            mainReserves);

        // compute slippage map for other pools
        for(const poolName of pools) {
            if(poolName == mainPool) {
                continue;
            }

            // find the closest block for this other pool that is just under or equal of the current blockNumber
            const nearestBlockNumbers = poolBlockNumbers[poolName].filter(_ => Number(_) <= blockNumber);
            if(nearestBlockNumbers.length == 0) {
                // if no data, ignore block
                continue;
            }

            // nearest block is the last one because blocks are sorted asc
            const nearestBlockNumber = Number(nearestBlockNumbers.at(-1));
            const poolDataForBlock = poolData[poolName].reserveValues[nearestBlockNumber];
            const reserves = [];
            for(const poolToken of poolData[poolName].poolTokens) {
                reserves.push(poolData[poolName].reserveValues[nearestBlockNumber][poolToken]);
            }
            const poolPriceAndSlippage = computePriceAndSlippageMapForReserveValue(fromSymbol,
                toSymbol,
                poolData[poolName].poolTokens,
                poolDataForBlock.ampFactor,
                poolDataForBlock.lpSupply,
                reserves);

            // add the slippageMap to the mainPool one
            for(const slippageBps of Object.keys(poolPriceAndSlippage.slippageMap)) {
                mainPriceAndSlippage.slippageMap[slippageBps] += poolPriceAndSlippage.slippageMap[slippageBps];
            }
        }
        
        lastSavedBlock = Number(blockNumber);
        toWrite.push(`${blockNumber},${mainPriceAndSlippage.price},${JSON.stringify(mainPriceAndSlippage.slippageMap)}\n`);

        if(toWrite.length >= 100) {
            fs.appendFileSync(unifiedFullFilename, toWrite.join(''));
            toWrite = [];
        }
    }
    

    if(toWrite.length == 0) {
        console.log(`${fnName()}: nothing to add to file`);
    } else {
        fs.appendFileSync(unifiedFullFilename, toWrite.join(''));
    }
}

// generateUnifiedFileCurve(18000000);

module.exports = { generateUnifiedFileCurve, createUnifiedFileForPair };