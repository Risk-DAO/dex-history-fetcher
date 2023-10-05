const pairsToCompute = {
    'WETH': [
        'USDC',
        'WBTC'
    ],
    'DAI': [
        'WETH',
        'USDC',
        'WBTC'
    ],
    'MANA': [
        'WETH',
        'USDC',
        'WBTC'
    ],
    'MKR': [
        'WETH',
        'USDC',
        'WBTC'
    ],
    'SNX': [
        'WETH',
        'USDC',
        'WBTC'
    ],
    'sUSD': [
        'WETH',
        'USDC',
        'WBTC'
    ],
    'UNI': [
        'WETH',
        'USDC',
        'WBTC'
    ],
    'USDC': [
        'WETH',
        'WBTC'
    ],
    'USDT': [
        'WETH',
        'USDC',
        'WBTC'
    ],
    'WBTC': [
        'USDC',
        'WETH'
    ]
};

const dashboardPairsToCompute = [
    {
        base: 'stETH',
        quote: 'WETH',
    },
    {
        base: 'USDC',
        quote: 'WETH',
    }
];

module.exports = { pairsToCompute, dashboardPairsToCompute };