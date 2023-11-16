const path = require('path');
const fs = require('fs');
const { fnName, readLastLine } = require('../utils/utils');
const { getAvailableCurve, getCurveDataforBlockInterval, computePriceAndSlippageMapForReserveValue, computePriceAndSlippageMapForReserveValueCryptoV2 } = require('./curve.utils');
const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { DATA_DIR } = require('../utils/constants');
const { getConfTokenBySymbol } = require('../utils/token.utils');

// this can be very long if done from the begining. 
async function generateUnifiedFileCurve(endBlock) {
    const available = getAvailableCurve(DATA_DIR);

    if(!fs.existsSync(path.join(DATA_DIR, 'precomputed', 'curve'))) {
        fs.mkdirSync(path.join(DATA_DIR, 'precomputed', 'curve'), {recursive: true});
    }

    for(const base of Object.keys(available)) {
        for(const quote of Object.keys(available[base])) {
            for(const pool of Object.keys(available[base][quote])) {
                await createUnifiedFileForPair(endBlock, base, quote, pool);
            }
        }
    }
}

async function createUnifiedFileForPair(endBlock, fromSymbol, toSymbol, poolName) {
    console.log(`${fnName()}: create/append for ${fromSymbol} ${toSymbol} for pools ${poolName}`);
    const unifiedFilename = `${fromSymbol}-${toSymbol}-${poolName}-unified-data.csv`;
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
    const poolData = getCurveDataforBlockInterval(DATA_DIR, poolName, sinceBlock, endBlock);
    let lastSavedBlock = sinceBlock-1;
    for(const blockNumber of Object.keys(poolData.reserveValues)) {        
        const dataForBlock = poolData.reserveValues[blockNumber];
        const reserves = [];
        for(const poolToken of poolData.poolTokens) {
            reserves.push(poolData.reserveValues[blockNumber][poolToken]);
        }

        let priceAndSlippage = undefined;
        if(poolData.isCryptoV2) {
            const precisions = [];
            for(const token of poolData.poolTokens) {
                const tokenConf = getConfTokenBySymbol(token);
                precisions.push(10n**BigInt(18 - tokenConf.decimals));
            }

            priceAndSlippage = computePriceAndSlippageMapForReserveValueCryptoV2(fromSymbol,
                toSymbol,
                poolData.poolTokens,
                dataForBlock.ampFactor,
                reserves,
                precisions,
                dataForBlock.gamma,
                dataForBlock.D,
                dataForBlock.priceScale);
        } else {
            priceAndSlippage = computePriceAndSlippageMapForReserveValue(fromSymbol,
                toSymbol,
                poolData.poolTokens,
                dataForBlock.ampFactor,
                reserves);
        }

        lastSavedBlock = Number(blockNumber);
        toWrite.push(`${blockNumber},${priceAndSlippage.price},${JSON.stringify(priceAndSlippage.slippageMap)}\n`);

        if(toWrite.length >= 50) {
            fs.appendFileSync(unifiedFullFilename, toWrite.join(''));
            toWrite = [];
        }
    }

    if(toWrite.length >= 0) {
        fs.appendFileSync(unifiedFullFilename, toWrite.join(''));
    }
}

// generateUnifiedFileCurve(19000000);

module.exports = { generateUnifiedFileCurve, createUnifiedFileForPair };