const { ethers } = require('ethers');
const dotenv = require('dotenv');
const path = require('path');
const { fnName, retry, getDay } = require('../../utils/utils');
const fs = require('fs');
const { default: axios } = require('axios');
dotenv.config();
const { getBlocknumberForTimestamp } = require('../../utils/web3.utils');
const { computeUniv3ParkinsonVolatility, getAverageLiquidityForBlockInterval } = require('../../uniswap.v3/uniswap.v3.utils');
const { computeAggregatedVolumeFromPivot } = require('../../utils/aggregator');
const { normalize, getConfTokenBySymbol } = require('../../utils/token.utils');
const { compoundV3Pools, cometABI } = require('./compoundV3Computer.config');
const { RecordMonitoring } = require('../../utils/monitoring');
const { DATA_DIR } = require('../../utils/constants');
const spans = [7, 30, 180];

async function compoundV3Computer(fetchEveryMinutes) {
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

        
        if(!fs.existsSync(path.join(DATA_DIR, 'clf'))) {
            fs.mkdirSync(path.join(DATA_DIR, 'clf'));
        }

        console.log(`${fnName()}: starting`);
        const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
        const currentBlock = await web3Provider.getBlockNumber() - 10;
        const results = {};
        /// for all pools in compound v3
        for (const pool of Object.values(compoundV3Pools)) {
            results[pool.baseAsset] = await computeCLFForPool(pool);
            const poolData = computeAverageCLFForPool(results[pool.baseAsset]);
            results[pool.baseAsset]['weightedCLF'] = poolData['weightedCLF'];
            results[pool.baseAsset]['totalCollateral'] = poolData['totalCollateral'];
            console.log(`results[${pool.baseAsset}]`, results[pool.baseAsset]);
        }

        let protocolWeightedCLF = undefined;
        try {
            protocolWeightedCLF = computeProtocolWeightedCLF(results);
        }
        catch (error) {
            console.log(error);
        }
        const toRecord = {
            protocol: 'compound v3',
            weightedCLF: protocolWeightedCLF,
            results
        };



        console.log('firing record function');
        recordResults(toRecord);

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
        console.log(errorMsg);
        await RecordMonitoring({
            'name': MONITORING_NAME,
            'status': 'error',
            'error': errorMsg
        });
    }

}

function recordResults(results) {
    const date = getDay();
    if (!fs.existsSync(`${DATA_DIR}/clf/${date}`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/${date}`);
    }
    if (!fs.existsSync(`${DATA_DIR}/clf/latest`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/latest`);
    }
    const datedProtocolFilename = path.join(DATA_DIR, `clf/${date}/${date}_compoundV3_CLFs.json`);
    const latestFullFilename = path.join(DATA_DIR, 'clf/latest/compoundV3_CLFs.json');
    const objectToWrite = JSON.stringify(results);
    console.log('recording results');
    try {
        fs.writeFileSync(datedProtocolFilename, objectToWrite, 'utf8');
        fs.writeFileSync(latestFullFilename, objectToWrite, 'utf8');
    }
    catch (error) {
        console.log(error);
        console.log('Compound Computer failed to write files');
    }
}

function computeProtocolWeightedCLF(protocolData) {
    let protocolCollateral = 0;
    const weightMap = {};
    for (const [market, marketData] of Object.entries(protocolData)) {
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
    for (const [clf, value] of Object.entries(weightMap)) {
        weightedCLF += value;
    }
    weightedCLF = (weightedCLF).toFixed(2);
    return weightedCLF;
}

async function computeCLFForPool(pool) {
    const resultsData = {};
    resultsData['data'] = {};

    console.log(`Started work on Compound v3 --- ${pool.baseAsset} --- pool`);
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const cometContract = new ethers.Contract(pool.cometAddress, cometABI, web3Provider);
    /// for all collaterals in selected pool
    for (const collateral of Object.values(pool.collateralTokens)) {
        try {
            console.log(`Computing CLFs for ${collateral.symbol}`);
            resultsData['data'][collateral.symbol] = {};
            resultsData['data'][collateral.symbol]['collateral'] = await getCollateralAmount(collateral, cometContract);
            resultsData['data'][collateral.symbol]['clfs'] = await computeMarketCLF(web3Provider, cometContract, collateral, pool.baseAsset);
            console.log('---------------------------');
            console.log('---------------------------');
            console.log('resultsData', resultsData);
            console.log('---------------------------');
            console.log('---------------------------');
        }
        catch (error) {
            console.log('error', error);
            resultsData['data'][collateral.symbol] = null;
        }
    }
    return resultsData;
}

async function getCollateralAmount(collateral, cometContract) {
    const [totalSupplyAsset] = await cometContract.callStatic.totalsCollateral(collateral.address);
    const decimals = getConfTokenBySymbol(collateral.symbol.toUpperCase()).decimals;
    const results = {};
    let price = undefined;
    const coinGeckoResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${collateral.coinGeckoID}&vs_currencies=usd`);
    try {
        price = coinGeckoResponse.data[collateral.coinGeckoID]['usd'];
    }
    catch (error) {
        console.log('error fetching price', error);
        price = 0;
    }
    results['inKindSupply'] = normalize(totalSupplyAsset, decimals);
    results['usdSupply'] = results['inKindSupply'] * price;
    return results;
}

function computeAverageCLFForPool(poolData) {
    //get pool total collateral in usd
    let totalCollateral = 0;
    for (const [collateral, value] of Object.entries(poolData['data'])) {
        if (value) {
            totalCollateral += value['collateral']['usdSupply'];
        }
    }
    const weightMap = {};
    // get each collateral weight
    for (const [collateral, value] of Object.entries(poolData['data'])) {
        if (value) {
            const weight = value['collateral']['usdSupply'] / totalCollateral;
            const clf = value['clfs']['7']['7'];
            weightMap[collateral] = weight * clf;
        }
    }
    let weightedCLF = 0;
    for (const [collateral, weight] of Object.entries(weightMap)) {
        weightedCLF += weight;
    }
    weightedCLF = (weightedCLF * 100).toFixed(2);
    return { weightedCLF, totalCollateral };
}



async function computeMarketCLF(web3Provider, cometContract, compoundV3Asset, to) {
    const from = compoundV3Asset.symbol;
    const assetParameters = await getAssetParameters(cometContract, compoundV3Asset);
    console.log('assetParameters', assetParameters);


    const endBlock = await retry((() => web3Provider.getBlockNumber()), []);
    const parameters = {};

    ///Get liquidities and volatilities for all spans
    for (const span of spans) {
        // find block for 'daysToAvg' days ago
        const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (span * 24 * 60 * 60));
        console.log(`${fnName()}: Will avg liquidity since block ${startBlock}`);

        const computedVolatility = getVolatility(span, from, to, startBlock, endBlock);
        const computedLiquidity = getLiquidity(assetParameters.liquidationBonusBPS, from, to, startBlock, endBlock);

        parameters[span] = {
            volatility: computedVolatility,
            liquidity: computedLiquidity
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

            results[volatilitySpan][liquiditySpan] = findCLFFromParameters(parameters[volatilitySpan].volatility, parameters[liquiditySpan].liquidity, assetParameters.liquidationBonusBPS / 10000, assetParameters.LTV, assetParameters.supplyCap);
        }
    }
    console.log('results', results);
    return results;
}


function findCLFFromParameters(volatility, liquidity, liquidationBonus, ltv, borrowCap) {
    ltv = Number(ltv) / 100;
    const sqrtResult = Math.sqrt(liquidity / borrowCap);
    const sqrtBySigma = sqrtResult / volatility;
    const ltvPlusBeta = Number(ltv) + Number(liquidationBonus);
    const lnLtvPlusBeta = Math.log(ltvPlusBeta);
    const c = -1 * lnLtvPlusBeta * sqrtBySigma;
    return c;
};

async function getAssetParameters(cometContract, compoundV3Asset) {
    const results = await cometContract.getAssetInfo(compoundV3Asset.index);
    const liquidationBonusBPS = Math.round((1 - normalize(results.liquidationFactor, 18)) * 10000);
    const LTV = normalize(results.liquidateCollateralFactor, 18) * 100;
    const tokenConf = getConfTokenBySymbol(compoundV3Asset.symbol);
    const supplyCap = normalize(results.supplyCap, tokenConf.decimals);
    return { liquidationBonusBPS, supplyCap, LTV };

}

function getVolatility(span, from, to, startBlock, endBlock) {
    const volatilityParkinson = computeUniv3ParkinsonVolatility(DATA_DIR, from, to, startBlock, endBlock, span);
    console.log(volatilityParkinson);
    return volatilityParkinson;
}

function getLiquidity(liquididationBonus, from, to, startBlock, endBlock) {

    console.log(`${fnName()}[${from}]: start finding data for ${liquididationBonus} bps slippage since block ${startBlock}`);
    const avgResult = getAverageLiquidityForBlockInterval(DATA_DIR, from, to, startBlock, endBlock);

    let avgLiquidityForTargetSlippage = avgResult.slippageMapAvg[liquididationBonus];
    console.log(`${fnName()}[${from}]: Computed average liquidity for ${liquididationBonus}bps slippage: ${avgLiquidityForTargetSlippage}`);

    // add volumes from WBTC and WETH pivots
    for (const pivot of ['WBTC', 'WETH']) {
        if (from == pivot) {
            continue;
        }

        const segment1AvgResult = getAverageLiquidityForBlockInterval(DATA_DIR, from, pivot, startBlock, endBlock);
        if (!segment1AvgResult) {
            console.log(`Could not find data for ${from}->${pivot}`);
            continue;
        }
        const segment2AvgResult = getAverageLiquidityForBlockInterval(DATA_DIR, pivot, to, startBlock, endBlock);
        if (!segment2AvgResult) {
            console.log(`Could not find data for ${pivot}->${to}`);
            continue;
        }

        const aggregVolume = computeAggregatedVolumeFromPivot(segment1AvgResult.slippageMapAvg, segment1AvgResult.averagePrice, segment2AvgResult.slippageMapAvg, liquididationBonus);
        console.log(`adding aggreg volume ${aggregVolume} from route ${from}->${pivot}->${to} for slippage ${liquididationBonus} bps`);
        avgLiquidityForTargetSlippage += aggregVolume;
        console.log(`new aggreg volume for ${from}->${to}: ${avgLiquidityForTargetSlippage} for slippage ${liquididationBonus} bps`);
    }
    return avgLiquidityForTargetSlippage;
}
module.exports = { compoundV3Computer };
