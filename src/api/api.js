const express = require('express');
const fs = require('fs');
const { getUniswapPriceAndLiquidity } = require('../uniswap.v2/uniswap.v2.utils');
const app = express();
const port = 3000;
const DATA_DIR = process.cwd() + '/data';

app.get('/api/available', (req, res) => {
    const available = {};
    const files = fs.readdirSync(DATA_DIR).filter(_ => _.endsWith('.csv'));
    for(const file of files) {
        const pair = file.split('_')[0];
        const platform = file.split('_')[1].replace('.csv', '');
        if(!available[platform]) {
            available[platform] = {};
        }

        const tokenA = pair.split('-')[0];
        const tokenB = pair.split('-')[1];
        if(!available[platform][tokenA]) {
            available[platform][tokenA] = [];
        }
        if(!available[platform][tokenB]) {
            available[platform][tokenB] = [];
        }
        available[platform][tokenA].push(tokenB);
        available[platform][tokenB].push(tokenA);
    }

    res.json(available);    
});

// getprice?platform=uniswapv2&from=ETH&to=USDC&blockNumber=124874157
app.get('/api/getprice', async (req, res, next) => {
    try {
        const platform = req.query.platform;
        const from = req.query.from;
        const to = req.query.to;
        const blockNumber = req.query.blockNumber;

        switch(platform.toLowerCase()) {
            case 'uniswapv2':
                res.json(await getUniswapPriceAndLiquidity(DATA_DIR, from, to, blockNumber));
                break;
            default:
                res.status(400).json({error: `Wrong platform: ${platform}`});
                break;
        }
    } catch(error) {
        next(error);
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
