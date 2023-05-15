/* eslint-disable */

const pythiaAbi = [{"inputs":[{"internalType":"address","name":"relayer","type":"address"},{"internalType":"address","name":"asset","type":"address"},{"internalType":"bytes32","name":"key","type":"bytes32"}],"name":"get","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"relayers","type":"address[]"},{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"bytes32[]","name":"keys","type":"bytes32[]"}],"name":"multiGet","outputs":[{"internalType":"uint256[]","name":"values","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"bytes32[]","name":"keys","type":"bytes32[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"}],"name":"multiSet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"bytes32","name":"key","type":"bytes32"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"set","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const pythiaAddress = '0x1f5c38d56071891A0ba3E374AD7AB50d5917B8FA';

const tokensToPush = [
    "WETH",
    "DAI",
    "MANA",
    "MKR",
    "SNX",
    "sUSD",
    "UNI",
    "USDT",
]

module.exports = { pythiaAbi, tokensToPush, pythiaAddress };