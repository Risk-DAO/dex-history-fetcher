const { BigNumber, utils } = require('ethers');
const {tokens} = require('../global.config');

/**
 * Normalize a integer value to a number
 * @param {string | BigNumber} amount 
 * @param {number} decimals 
 * @returns {number} normalized number for the decimals in inputs
 */
function normalize(amount, decimals) {
    if(decimals === 18) {
        return Number(utils.formatEther(amount));
    }
    else if(decimals > 18) {
        const factor = BigNumber.from('10').pow(BigNumber.from(decimals - 18));
        const norm = BigNumber.from(amount.toString()).div(factor);
        return Number(utils.formatEther(norm));
    } else {
        const factor = BigNumber.from('10').pow(BigNumber.from(18 - decimals));
        const norm = BigNumber.from(amount.toString()).mul(factor);
        return Number(utils.formatEther(norm));
    }
}

/**
 * get a token configuration object searching by symbol
 * @param {string} symbol 
 * @returns {{decimals: number, address: string}} token configuration
 */
function getConfTokenBySymbol(symbol) {
    const tokenConf = tokens[symbol];
    if(!tokenConf) {
        throw new Error(`Cannot find token with symbol ${symbol}`);
    }
    // add symbol to config
    tokenConf.symbol = symbol;
    return tokenConf;
}

/**
 * Get a token symbol from the configuration, searching by address
 * @param {string} address 
 * @returns {string} token symbol
 */
function getTokenSymbolByAddress(address) {
    for(let [tokenSymbol, tokenConf] of Object.entries(tokens)) {
        if(tokenConf.address.toLowerCase() == address.toLowerCase()) {
            return tokenSymbol;
        }
    }

    return null;
}

/**
 * Compute the aggregated volume from two segments
 * Example to compute the volume for slippage of UNI/USDC using the two "segments"
 * UNI/WETH and WETH/USDC
 * Example for a target of 5% slippage:
 *  Start by trying to get the volume for 0.5% slippage of UNI/WETH and check if the amount of WETH
 *  obtainable is <= the volume for WETH/USDC for 4.5% slippage. If not, ignore, else save the UNI base amount for 0.5% slippage
 *  only if it's the maximum value we ever got. Then try for 1% slippage UNI/WETH and check against 4% slippage WETH/USDC
 *  This function then returns the maximum of UNI that is available using the route UNI/WETH -> WETH/USDC and a total of 5% slippage
 * @param {{[slippageBps: number]: number}} segment1Data 
 * @param {number} segment1Price 
 * @param {{[slippageBps: number]: number}} segment2Data 
 * @param {number} targetSlippageBps 
 */
function computeAggregatedVolumeFromPivot(segment1Data, segment1Price, segment2Data, targetSlippageBps) {
    let maxBaseAmount = 0;

    for(let bps = 50; bps < targetSlippageBps; bps += 50) {
        const segment1LiquidityForSlippage = segment1Data[bps];
        const segment2LiquidityForSlippage = segment2Data[targetSlippageBps - bps];
        const amountOfPivotObtainable = segment1LiquidityForSlippage * segment1Price * (10000 - bps) / 10000;

        // check that you can dump liquidity from segment1 into the liquidity for segment2
        if(amountOfPivotObtainable <= segment2LiquidityForSlippage) {

            // check if the maxBaseAmount is not higher, if not, consider this route the best route
            if(maxBaseAmount < segment1LiquidityForSlippage) {
                maxBaseAmount = segment1LiquidityForSlippage;
            }
        }
    }

    return maxBaseAmount;
}

module.exports = { normalize, getTokenSymbolByAddress, getConfTokenBySymbol, computeAggregatedVolumeFromPivot};