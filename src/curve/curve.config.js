/* eslint-disable */
const curveFactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';

const curveFactoryABI = {};
const curvePairABI = {};
const curvePairs = [
    {
        poolAddress: '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7',
        poolName: '3Pool',
        version: 1,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a',
        poolName: 'busdv2',
        version: 1,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0x8fdb0bB9365a46B145Db80D0B1C5C5e979C84190',
        poolName: 'BUSDFRAXBP',
        version: 1,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0x79a8C46DeA5aDa233ABaFFD40F3A0A2B1e5A4F27',
        poolName: 'BUSD',
        version: 1,
        abi: 'susdABI'
    },
    {
        poolAddress: '0xa5407eae9ba41422680e2e00537571bcc53efbfd',
        poolName: 'susd',
        version: 1,
        abi: 'susdABI'
    },
    {
        poolAddress: '0xd51a44d3fae010294c616388b506acda1bfaae46',
        poolName: 'tricrypto2',
        version: 2,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0xc26b89a667578ec7b3f11b2f98d6fd15c07c54ba',
        poolName: 'YFI-ETH',
        version: 2,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0xdcef968d416a41cdac0ed8702fac8128a64241a2',
        poolName: 'fraxusdc',
        version: 1,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0x8301ae4fc9c624d1d396cbdaa1ed877821d7c511',
        poolName: 'crveth',
        version: 2,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0xb576491f1e6e5e62f1d8f26062ee822b40b0e0d4',
        poolName: 'cvxeth',
        version: 2,
        abi: 'erc20ABI',
        wethIsEth:true
    },
    {
        poolAddress: '0x13b876c26ad6d21cb87ae459eaf6d7a1b788a113',
        poolName: 'BADGER-FRAXBP',
        version: 2,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0x50f3752289e1456bfa505afd37b241bca23e685d',
        poolName: 'BADGER-WBTC',
        version: 2,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0x9409280dc1e6d33ab7a8c6ec03e5763fb61772b5',
        poolName: 'LDO-ETH',
        version: 2,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0x4149d1038575ce235e03e03b39487a80fd709d31',
        poolName: 'ALCX-FraxBP',
        version: 2,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0xdc24316b9ae028f1497c275eb9192a3ea0f67022',
        poolName: 'steth',
        version: 1,
        abi: 'erc20ABI'
    },
    {
        poolAddress: '0xf9440930043eb3997fc70e1339dbb11f341de7a8',
        poolName: 'reth',
        version: 1,
        abi: 'erc20ABI'
    }
]

module.exports = { curveFactoryAddress, curveFactoryABI, curvePairABI, curvePairs };