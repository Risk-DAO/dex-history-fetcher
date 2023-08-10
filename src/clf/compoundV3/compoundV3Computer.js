const { ethers } = require('ethers');
const BigNumber = require('bignumber.js');
const dotenv = require('dotenv');
const { fnName, retry } = require('../../utils/utils');
dotenv.config();
const { getBlocknumberForTimestamp } = require('../../utils/web3.utils');
const { computeUniv3ParkinsonVolatility, getAverageLiquidityForBlockInterval } = require('../../uniswap.v3/uniswap.v3.utils');
const { computeAggregatedVolumeFromPivot } = require('../../utils/aggregator');
const { normalize, getConfTokenBySymbol } = require('../../utils/token.utils');
const compoundV3ComputerConfig = require('./compoundV3Computer.config');

const CONSTANT_1e18 = new BigNumber(10).pow(18);
const DATA_DIR = process.cwd() + '/data';
const spans = [7, 30, 180];

const compoundV3Asset = {
    index:2,
    symbol:'WETH'
};

async function computeMarketCLF(from, to) {
    const web3Provider = new ethers.providers.StaticJsonRpcProvider(process.env.RPC_URL);
    const cometContract = new ethers.Contract('0xc3d688B66703497DAA19211EEdff47f25384cdc3', compoundV3ComputerConfig.cometABI, web3Provider);
    const assetParameters = await getAssetParameters(cometContract, compoundV3Asset);
    console.log('assetParameters', assetParameters);


    const endBlock = await retry((() => web3Provider.getBlockNumber()), []);
    const results = {};
    for (const span of spans) {
        // find block for 'daysToAvg' days ago
        const startBlock = await getBlocknumberForTimestamp(Math.round(Date.now() / 1000) - (span * 24 * 60 * 60));
        console.log(`${fnName()}: Will avg liquidity since block ${startBlock}`);

        const computedVolatility = getVolatility(span, from, to, startBlock, endBlock);
        const computedLiquidity = getLiquidity(assetParameters.liquidationBonusBPS, from, to, startBlock, endBlock);

        results[span] = {
            volatility: computedVolatility,
            liquidity: computedLiquidity
        };
    }
    console.log('results', results);
}

async function getAssetParameters(cometContract, compoundV3Asset){
    const results = await cometContract.getAssetInfo(compoundV3Asset.index);
    const liquidationBonusBPS = Math.round((1 - normalize(results.liquidationFactor, 18)) * 10000);
    const tokenConf = getConfTokenBySymbol(compoundV3Asset.symbol);
    const supplyCap =  normalize(results.supplyCap, tokenConf.decimals);
    return {liquidationBonusBPS, supplyCap};

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

computeMarketCLF('WETH', 'USDC', 500);

