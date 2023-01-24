/* eslint-disable */
const curveFactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';

const curveFactoryABI = {};
const curvePairABI = {};
const curvePairs = {
    "DAI-USDC-USDT": [
        {
            "symbol": "DAI",
            "address": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        }, 
        {
            "symbol": "USDC",
            "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        }, 
        {
            "symbol": "USDT",
            "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        }
    ]
}

module.exports = { curveFactoryAddress, curveFactoryABI, curvePairABI, curvePairs };