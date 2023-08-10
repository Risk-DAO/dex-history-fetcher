const { ethers } = require('ethers');
const BigNumber = require('bignumber.js');
const dotenv = require('dotenv');
const { fnName, retry } = require('../../utils/utils');
dotenv.config();
const { getBlocknumberForTimestamp } = require('../../utils/web3.utils');
const { computeUniv3ParkinsonVolatility, getAverageLiquidityForBlockInterval } = require('../../uniswap.v3/uniswap.v3.utils');
const { computeAggregatedVolumeFromPivot } = require('../../utils/aggregator');
const { normalize, getConfTokenBySymbol } = require('../../utils/token.utils');
const { compoundV3Pools, cometABI } = require('./compoundV3Computer.config');

const CONSTANT_1e18 = new BigNumber(10).pow(18);
const DATA_DIR = process.cwd() + '/data';
const spans = [7, 30, 180];


async function main() {
    /// for all pools in compound v3
    for (const pool of Object.values(compoundV3Pools)) {
        console.log(`Started work on Compound v3 --- ${pool.baseAsset} --- pool`);
        const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
        const cometContract = new ethers.Contract(pool.cometAddress, cometABI, web3Provider);
        /// for all collaterals in selected pool
        for (const collateral of Object.values(pool.collateralTokens)) {
            console.log(`Computing CLFs for ${collateral.symbol}`);
            const poolCLFs = await computeMarketCLF(web3Provider, cometContract, collateral, pool.baseAsset);
            console.log('---------------------------');
            console.log('---------------------------');
            console.log('poolCLFs', poolCLFs);
            console.log('---------------------------');
            console.log('---------------------------');

        }
    }
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
    for(let i = 0; i < spans.length; i++){
        const volatilitySpan = spans[i];
        console.log('volatilitySpan', volatilitySpan);
        results[volatilitySpan] = {};
        for(let j = 0; j < spans.length; j ++){
            const liquiditySpan = spans[j];
            console.log('liquiditySpan', liquiditySpan);

            results[volatilitySpan][liquiditySpan] = findCLFFromParameters(parameters[volatilitySpan].volatility, parameters[liquiditySpan].liquidity, assetParameters.liquidationBonusBPS / 10000, assetParameters.LTV, assetParameters.supplyCap);
        }
    }
    return results;
}


function findCLFFromParameters(volatility, liquidity, liquidationBonus, ltv, borrowCap) {
    console.log('findCLFFromParameters');
    console.log(volatility, liquidity, liquidationBonus, ltv, borrowCap);
    ltv = Number(ltv) / 100;
    const sqrtResult = Math.sqrt(liquidity/borrowCap);
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

main();