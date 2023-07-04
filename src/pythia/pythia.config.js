/* eslint-disable */

const pythiaAbi = [{"inputs":[{"internalType":"address","name":"relayer","type":"address"},{"internalType":"address","name":"asset","type":"address"},{"internalType":"bytes32","name":"key","type":"bytes32"}],"name":"get","outputs":[{"components":[{"internalType":"uint224","name":"value","type":"uint224"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Pythia.Data","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"relayers","type":"address[]"},{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"bytes32[]","name":"keys","type":"bytes32[]"}],"name":"multiGet","outputs":[{"components":[{"internalType":"uint224","name":"value","type":"uint224"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Pythia.Data[]","name":"results","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"bytes32[]","name":"keys","type":"bytes32[]"},{"internalType":"uint224[]","name":"values","type":"uint224[]"},{"internalType":"uint32[]","name":"updateTimes","type":"uint32[]"}],"name":"multiSet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"bytes32","name":"key","type":"bytes32"},{"internalType":"uint224","name":"value","type":"uint224"},{"internalType":"uint32","name":"updateTime","type":"uint32"}],"name":"set","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const keyEncoderAbi = [{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"debtAsset","type":"address"},{"internalType":"enum KeyEncoder.LiquiditySource","name":"source","type":"uint8"},{"internalType":"uint256","name":"slippage","type":"uint256"},{"internalType":"uint256","name":"period","type":"uint256"}],"name":"encodeLiquidityKey","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"debtAsset","type":"address"},{"internalType":"enum KeyEncoder.VolatilityMode","name":"mode","type":"uint8"},{"internalType":"uint256","name":"period","type":"uint256"}],"name":"encodeVolatilityKey","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"pure","type":"function"}]
const pythiaAddress = '0x7DbC68f052924d7177b9D515bc278BE108a2923c';
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