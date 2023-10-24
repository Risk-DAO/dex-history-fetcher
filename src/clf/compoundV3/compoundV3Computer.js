const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');
const { fnName, getDay, roundTo, retry } = require('../../utils/utils');
const fs = require('fs');
const { default: axios } = require('axios');
dotenv.config();
const { getBlocknumberForTimestamp } = require('../../utils/web3.utils');
const { normalize, getConfTokenBySymbol } = require('../../utils/token.utils');
const { compoundV3Pools, cometABI } = require('./compoundV3Computer.config');
const { RecordMonitoring } = require('../../utils/monitoring');
const { DATA_DIR, PLATFORMS } = require('../../utils/constants');
const { getVolatility, getAverageLiquidity } = require('../../data.interface/data.interface');
const spans = [7, 30, 180];

/**
 * Compute the CLFs values for compound v3
 * @param {number} fetchEveryMinutes 
 */
async function compoundV3Computer(fetchEveryMinutes, startDate=Date.now()) {
    const MONITORING_NAME = 'CompoundV3 CLF Computer';
    const start = Date.now();
    try {
        await RecordMonitoring({
            'name': MONITORING_NAME,
            'status': 'running',
            'lastStart': Math.round(start / 1000),
            'runEvery': fetchEveryMinutes * 60
        });
        if (!process.env.RPC_URL) {
            throw new Error('Could not find RPC_URL env variable');
        }


        if (!fs.existsSync(path.join(DATA_DIR, 'clf'))) {
            fs.mkdirSync(path.join(DATA_DIR, 'clf'));
        }

        console.log(`${fnName()}: starting`);
        const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
        // precompute the fromBlocks for all spans
        // fromBlocks will look like that for spans 7, 30, 180: 
        // {
        //     7: 15784154, --> block 7 days ago
        //     30: 14878410, --> block 30 days ago
        //     180: 112548787 --> block 180 days ago
        // }
        const fromBlocks = {};
        for(const span of spans) {
            const startBlock = await getBlocknumberForTimestamp(Math.round(startDate/ 1000) - (span * 24 * 60 * 60));
            fromBlocks[span] = startBlock;
        }

        const currentBlock =  await getBlocknumberForTimestamp(Math.round(startDate/ 1000));
        const results = {};
        const averagePerAsset = {};
        const startDateUnixSecond = Math.round(startDate/1000);
        /// for all pools in compound v3
        for (const pool of Object.values(compoundV3Pools)) {
            results[pool.baseAsset] = await computeCLFForPool(pool.cometAddress, pool.baseAsset, Object.values(pool.collateralTokens), web3Provider, fromBlocks, currentBlock, startDateUnixSecond);
            const averagePoolData = computeAverageCLFForPool(results[pool.baseAsset]);
            results[pool.baseAsset]['weightedCLF'] = averagePoolData.weightedCLF;
            results[pool.baseAsset]['totalCollateral'] = averagePoolData.totalCollateral;
            averagePerAsset[pool.baseAsset] = averagePoolData;
            console.log(`results[${pool.baseAsset}]`, results[pool.baseAsset]);
        }

        let protocolWeightedCLF = undefined;
        try {
            protocolWeightedCLF = computeProtocolWeightedCLF(averagePerAsset);
        }
        catch (error) {
            console.error(error);
        }
        const toRecord = {
            protocol: 'compound v3',
            weightedCLF: protocolWeightedCLF,
            results
        };

        console.log('firing record function');
        recordResults(toRecord, startDate);

        console.log('CompoundV3 CLF Computer: ending');

        const runEndDate = Math.round(Date.now() / 1000);
        await RecordMonitoring({
            'name': MONITORING_NAME,
            'status': 'success',
            'lastEnd': runEndDate,
            'lastDuration': runEndDate - Math.round(start / 1000),
            'lastBlockFetched': currentBlock
        });
    } catch (error) {
        const errorMsg = `An exception occurred: ${error}`;
        console.error(errorMsg);
        await RecordMonitoring({
            'name': MONITORING_NAME,
            'status': 'error',
            'error': errorMsg
        });
    }
}

/**
 * Compute CLF value for a pool
 * @param {string} cometAddress 
 * @param {string} baseAsset 
 * @param {{index: number, symbol: string, address: string, coinGeckoID: string}[]} collaterals 
 * @param {ethers.providers.StaticJsonRpcProvider} web3Provider 
 * @param {{[span: number]: number}} fromBlocks 
 * @param {number} endBlock 
 * @returns {Promise<{collateralsData: {[collateralSymbol: string]: {collateral: {inKindSupply: number, usdSupply: number}, clfs: {7: {volatility: number, liquidity: number}, 30: {volatility: number, liquidity: number}, 180: {volatility: number, liquidity: number}}}}>}
 */
async function computeCLFForPool(cometAddress, baseAsset, collaterals, web3Provider, fromBlocks, endBlock, startDateUnixSec) {
    const resultsData = {
        collateralsData: {}
    };

    console.log(`Started work on Compound v3 --- ${baseAsset} --- pool`);
    const cometContract = new ethers.Contract(cometAddress, cometABI, web3Provider);
    /// for all collaterals in selected pool
    for (const collateral of collaterals) {
        try {
            console.log(`Computing CLFs for ${collateral.symbol}`);
            const assetParameters = await getAssetParameters(cometContract, collateral);
            console.log('assetParameters', assetParameters);
            resultsData.collateralsData[collateral.symbol] = {};
            resultsData.collateralsData[collateral.symbol].collateral = await getCollateralAmount(collateral, cometContract, startDateUnixSec);
            resultsData.collateralsData[collateral.symbol].clfs = await computeMarketCLF(assetParameters, collateral, baseAsset, fromBlocks, endBlock);
            // resultsData.collateralsData[collateral.symbol].liquidityHistory = await computeLiquidityHistory(collateral, fromBlocks, endBlock, baseAsset, assetParameters);
            console.log('resultsData', resultsData);
        }
        catch (error) {
            console.error('error', error);
            resultsData[collateral.symbol] = null;
        }
    }
    return resultsData;
}

/**
 * Get collateral amount from on-chaind data
 * @param {{index: number, symbol: string, address: string, coinGeckoID: string}} collateral 
 * @param {ethers.Contract} cometContract 
 * @returns 
 */
async function getCollateralAmount(collateral, cometContract, priceDateUnixSeconds) {
    const [totalSupplyAsset] = await cometContract.callStatic.totalsCollateral(collateral.address);
    const decimals = getConfTokenBySymbol(collateral.symbol).decimals;
    const results = {};
    let price = undefined;
    const apiUrl = `https://coins.llama.fi/prices/historical/${priceDateUnixSeconds}/ethereum:${collateral.address}?searchWidth=12h`;

    const historicalPriceResponse = await retry(axios.get, [apiUrl], 0, 100);
    try {
        price = historicalPriceResponse.data.coins[`ethereum:${collateral.address}`].price;
    }
    catch (error) {
        console.error('error fetching price', error);
        price = 0;
    }
    results['inKindSupply'] = normalize(totalSupplyAsset, decimals);
    results['usdSupply'] = results['inKindSupply'] * price;
    return results;
}

/**
 * 
 * @param {{liquidationBonusBPS: number, supplyCap: number, LTV: number}} assetParameters 
 * @param {{index: number, symbol: string, volatilityPivot: string, address: string, coinGeckoID: string}} collateral 
 * @param {string} baseAsset 
 * @param {{[span: number]: number}]} fromBlocks 
 * @param {number} endBlock 
 * @returns {Promise<{7: {volatility: number, liquidity: number}, 30: {volatility: number, liquidity: number}, 180: {volatility: number, liquidity: number}}>}
 */
async function computeMarketCLF(assetParameters, collateral , baseAsset, fromBlocks, endBlock) {
    const from = collateral.symbol;

    const parameters = {};

    ///Get liquidities and volatilities for all spans
    for (const span of spans) {
        // find block for 'daysToAvg' days ago
        const startBlock = fromBlocks[span];
        console.log(`${fnName()}: Will avg liquidity since block ${startBlock}`);

        let avgVolatilityAcrossPlatforms = 0;
        let sumLiquidityAcrossPlatforms = 0;
        let cptVolatility = 0;

        for (const platform of PLATFORMS) {
            const plaformVolatility = getVolatility(platform, from, baseAsset, startBlock, endBlock, span, collateral.volatilityPivot);

            // count platform volatility only if not 0, otherwise we would divide too much
            // example the curve volatility of WETH/USDC is 0 because we don't have data for WETH/USDC on curve
            if (plaformVolatility != 0) {
                cptVolatility++;
            }

            avgVolatilityAcrossPlatforms += plaformVolatility;

            const platformLiquidity = getAverageLiquidity(platform, from, baseAsset, startBlock, endBlock);
            sumLiquidityAcrossPlatforms += platformLiquidity.avgSlippageMap[assetParameters.liquidationBonusBPS].base;
        }

        avgVolatilityAcrossPlatforms = cptVolatility == 0 ? 0 : avgVolatilityAcrossPlatforms / cptVolatility;

        if (sumLiquidityAcrossPlatforms == 0) {
            throw new Error(`No data for ${from}/${baseAsset} for span ${span}`);
        }

        parameters[span] = {
            volatility: avgVolatilityAcrossPlatforms,
            liquidity: sumLiquidityAcrossPlatforms
        };
    }

    console.log('parameters', parameters);
    /// compute CLFs for all spans and all volatilities
    const results = {};
    for (let i = 0; i < spans.length; i++) {
        const volatilitySpan = spans[i];
        results[volatilitySpan] = {};
        for (let j = 0; j < spans.length; j++) {
            const liquiditySpan = spans[j];
            if (parameters[volatilitySpan].volatility !== 0) {
                let volatilityToUse = parameters[volatilitySpan].volatility;
                if(volatilityToUse < 1 / 10000) {
                    volatilityToUse = parameters[spans[i+1]].volatility;
                }

                results[volatilitySpan][liquiditySpan] = findRiskLevelFromParameters(volatilityToUse, parameters[liquiditySpan].liquidity, assetParameters.liquidationBonusBPS / 10000, assetParameters.LTV, assetParameters.supplyCap);
            }
        }
    }
    console.log('results', results);
    return results;
}

/**
 * 
 * @param {ethers.Contract} cometContract 
 * @param {{index: number, symbol: string, address: string, coinGeckoID: string}} collateral 
 * @returns 
 */
async function getAssetParameters(cometContract, collateral) {
    const results = await cometContract.getAssetInfo(collateral.index);
    const liquidationBonusBPS = Math.round((1 - normalize(results.liquidationFactor, 18)) * 10000);
    const LTV = normalize(results.liquidateCollateralFactor, 18) * 100;
    const tokenConf = getConfTokenBySymbol(collateral.symbol);
    const supplyCap = normalize(results.supplyCap, tokenConf.decimals);
    return { liquidationBonusBPS, supplyCap, LTV };

}

/**
 * 
 * @param {number} volatility 
 * @param {number} liquidity 
 * @param {number} liquidationBonus 
 * @param {number} ltv 
 * @param {number} borrowCap 
 * @returns 
 */
function findCLFFromParameters(volatility, liquidity, liquidationBonus, ltv, borrowCap) {
    ltv = Number(ltv) / 100;
    const sqrtResult = Math.sqrt(liquidity / borrowCap);
    const sqrtBySigma = sqrtResult / volatility;
    const ltvPlusBeta = Number(ltv) + Number(liquidationBonus);
    const lnLtvPlusBeta = Math.log(ltvPlusBeta);
    const c = -1 * lnLtvPlusBeta * sqrtBySigma;
    return c;
}

function findRiskLevelFromParameters(volatility, liquidity, liquidationBonus, ltv, borrowCap) {
    const sigma = volatility;
    const d = borrowCap;
    const beta = liquidationBonus;
    const l = liquidity;
    ltv = Number(ltv) / 100;

    const sigmaTimesSqrtOfD = sigma * Math.sqrt(d);
    const ltvPlusBeta = ltv + beta;
    const lnOneDividedByLtvPlusBeta = Math.log(1/ltvPlusBeta);
    const lnOneDividedByLtvPlusBetaTimesSqrtOfL = lnOneDividedByLtvPlusBeta * Math.sqrt(l);
    const r = sigmaTimesSqrtOfD / lnOneDividedByLtvPlusBetaTimesSqrtOfL;

    return r;
}

/**
 * 
 * @param {{collateralsData: {[collateralSymbol: string]: {collateral: {inKindSupply: number, usdSupply: number}, clfs: {7: {volatility: number, liquidity: number}, 30: {volatility: number, liquidity: number}, 180: {volatility: number, liquidity: number}}}}} poolData 
 * @returns 
 */
function computeAverageCLFForPool(poolData) {
    //get pool total collateral in usd
    let totalCollateral = 0;
    for (const value of Object.values(poolData.collateralsData)) {
        if (value) {
            totalCollateral += value.collateral.usdSupply;
        }
    }
    const weightMap = {};
    // get each collateral weight
    for (const [collateral, value] of Object.entries(poolData.collateralsData)) {
        if (value) {
            const weight = value.collateral.usdSupply / totalCollateral;
            const clf = value['clfs']['7']['7'] ? value['clfs']['7']['7'] : value['clfs']['30']['7'] ? value['clfs']['30']['7'] : value['clfs']['180']['7'];
            weightMap[collateral] = weight * clf;
        }
    }
    let weightedCLF = 0;
    for (const weight of Object.values(weightMap)) {
        weightedCLF += weight;
    }
    weightedCLF = roundTo(weightedCLF, 2);
    return { weightedCLF, totalCollateral };
}

/**
 * 
 * @param {{[baseAsset: string]: {totalCollateral: number, weightedCLF: number}}} protocolData 
 * @returns 
 */
function computeProtocolWeightedCLF(protocolData) {
    let protocolCollateral = 0;
    const weightMap = {};
    for (const marketData of Object.values(protocolData)) {
        if (marketData) {
            protocolCollateral += marketData['totalCollateral'];
        }
    }
    // get each collateral weight
    for (const [market, marketData] of Object.entries(protocolData)) {
        if (marketData) {
            const weight = marketData['totalCollateral'] / protocolCollateral;
            const clf = marketData['weightedCLF'];
            weightMap[market] = weight * clf;
        }
    }
    let weightedCLF = 0;
    for (const value of Object.values(weightMap)) {
        weightedCLF += value;
    }
    weightedCLF = roundTo(weightedCLF, 2);
    return weightedCLF;
}

function recordResults(results, timestamp=undefined) {
    const date = getDay(timestamp);
    if (!fs.existsSync(`${DATA_DIR}/clf/${date}`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/${date}`);
    }
    if (!fs.existsSync(`${DATA_DIR}/clf/latest`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/latest`);
    }
    const datedProtocolFilename = path.join(DATA_DIR, `clf/${date}/${date}_compoundv3_CLFs.json`);
    const latestFullFilename = path.join(DATA_DIR, 'clf/latest/compoundv3_CLFs.json');
    const objectToWrite = JSON.stringify(results);
    console.log('recording results');
    try {
        fs.writeFileSync(datedProtocolFilename, objectToWrite, 'utf8');
        fs.writeFileSync(latestFullFilename, objectToWrite, 'utf8');
    }
    catch (error) {
        console.error(error);
        console.log('Compound Computer failed to write files');
    }
}

module.exports = { compoundV3Computer };
