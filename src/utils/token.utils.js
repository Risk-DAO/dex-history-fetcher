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
 * @returns {{symbol: string, decimals: number, address: string}} token configuration
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


module.exports = { normalize, getTokenSymbolByAddress, getConfTokenBySymbol };