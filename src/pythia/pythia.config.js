/* eslint-disable */

const pythiaAbi = [{"inputs":[{"internalType":"address","name":"relayer","type":"address"},{"internalType":"address","name":"asset","type":"address"},{"internalType":"bytes32","name":"key","type":"bytes32"}],"name":"get","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"lastUpdate","type":"uint256"}],"internalType":"struct Pythia.Data","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"relayers","type":"address[]"},{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"bytes32[]","name":"keys","type":"bytes32[]"}],"name":"multiGet","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"lastUpdate","type":"uint256"}],"internalType":"struct Pythia.Data[]","name":"results","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"bytes32[]","name":"keys","type":"bytes32[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"},{"internalType":"uint256[]","name":"updateTimes","type":"uint256[]"}],"name":"multiSet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"bytes32","name":"key","type":"bytes32"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"updateTime","type":"uint256"}],"name":"set","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const keyEncoderAbi = [{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"debtAsset","type":"address"},{"internalType":"enum KeyEncoder.LiquiditySource","name":"source","type":"uint8"},{"internalType":"uint256","name":"slippage","type":"uint256"},{"internalType":"uint256","name":"period","type":"uint256"}],"name":"encodeLiquidityKey","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"debtAsset","type":"address"},{"internalType":"enum KeyEncoder.VolatilityMode","name":"mode","type":"uint8"},{"internalType":"uint256","name":"period","type":"uint256"}],"name":"encodeVolatilityKey","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"}]
const pythiaAddress = '0x1e4b58E544fcCfbF4aB68c2df8F5747714C5B592';
const keyEncoderAddress = '0x36BDa8b93769523581f85D65d0bD81DaEd32C2b0';

const tokensToPush = [
    "WETH",
    "DAI",
    "MANA",
    "MKR",
    "SNX",
    "sUSD",
    "UNI",
    "USDT",
    "WBTC"
]

module.exports = { pythiaAbi, tokensToPush, pythiaAddress, keyEncoderAbi, keyEncoderAddress };