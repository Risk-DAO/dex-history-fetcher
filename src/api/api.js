const express = require('express');
const fs = require('fs');
const { getCurvePriceAndLiquidity } = require('../curve/curve.utils');
const { getUniswapPriceAndLiquidity, getUniswapAveragePriceAndLiquidity } = require('../uniswap.v2/uniswap.v2.utils');
var cors = require('cors');
const { default: axios } = require('axios');
const app = express();
app.use(cors());
const port = process.env.API_PORT || 3000;
const DATA_DIR = process.cwd() + '/data';

function getAvailableUniswapV2() {
    const available = {};
    const files = fs.readdirSync(`${DATA_DIR}/uniswapv2/`).filter(_ => _.endsWith('.csv'));
    for(const file of files) {
        const pair = file.split('_')[0];

        const tokenA = pair.split('-')[0];
        const tokenB = pair.split('-')[1];
        if(!available[tokenA]) {
            available[tokenA] = [];
        }
        if(!available[tokenB]) {
            available[tokenB] = [];
        }
        available[tokenA].push(tokenB);
        available[tokenB].push(tokenA);
    }

    return available;
}

function getAvailableCurve() {
    const summary = JSON.parse(fs.readFileSync(`${DATA_DIR}/curve/curve_pools_summary.json`));
    const available = {};
    for(const poolName of Object.keys(summary)) {
        for(const [token, reserveValue] of Object.entries(summary[poolName])) {
            if(!available[token]) {
                available[token] = {};
            }

            for(const [tokenB, reserveValueB] of Object.entries(summary[poolName])) {
                if(tokenB === token) {
                    continue;
                }
                
                available[token][tokenB] = available[token][tokenB] || {};
                available[token][tokenB][poolName] = available[token][tokenB][poolName] || {};
                available[token][tokenB][poolName][token] = reserveValue;
                available[token][tokenB][poolName][tokenB] = reserveValueB;
            }
        }
    }
    return available;
}

app.get('/api/available', (req, res) => {
    const available = {};
    available['uniswapv2'] = getAvailableUniswapV2();
    available['curve'] = getAvailableCurve();

    res.json(available);    
});

// getprice?platform=uniswapv2&from=ETH&to=USDC&timestamp=1658171864&poolName=3pool
app.get('/api/getprice', async (req, res, next) => {
    try {
        console.log('received getprice request', req);
        const platform = req.query.platform;
        const from = req.query.from;
        const to = req.query.to;
        const timestamp = Number(req.query.timestamp);

        if(!timestamp) {
            res.status(400).json({error: 'timestamp required'});
            next();
        }

        // get nearest blocknum from defillama
        console.log(`calling defillama: https://coins.llama.fi/block/ethereum/${timestamp}`);
        const defiLamaResp = await axios.get(`https://coins.llama.fi/block/ethereum/${timestamp}`);
        const blockNumber = defiLamaResp.data.height;
        console.log('defillama resp:', defiLamaResp.data);

        switch(platform.toLowerCase()) {
            case 'uniswapv2':
                res.json(await getUniswapPriceAndLiquidity(DATA_DIR, from, to, blockNumber));
                break;
            case 'curve': 
            {
                const poolName = req.query.poolName;
                if(!poolName) {
                    res.status(400).json({error: 'poolName required for curve'});
                    next();
                }
                res.json(await getCurvePriceAndLiquidity(DATA_DIR, poolName, from, to, blockNumber));
                break;
            }
            default:
                res.status(400).json({error: `Wrong platform: ${platform}`});
                break;
        }
    } catch(error) {
        next(error);
    }
});

// getprice?platform=uniswapv2&from=ETH&to=USDC&fromTimestamp=10008555&toTimestamp=11000000
app.get('/api/getaverageprice', async (req, res, next) => {
    try {
        console.log('received getaverageprice request', req);
        const platform = req.query.platform;
        const from = req.query.from;
        const to = req.query.to;
        const fromTimestamp = Number(req.query.fromTimestamp);
        const toTimestamp = Number(req.query.toTimestamp);
        
        // get nearest blocknum from defillama
        console.log(`calling defillama: https://coins.llama.fi/block/ethereum/${fromTimestamp}`);
        let defiLamaResp = await axios.get(`https://coins.llama.fi/block/ethereum/${fromTimestamp}`);
        console.log('defillama resp:', defiLamaResp.data);
        const fromBlock = defiLamaResp.data.height;


        console.log(`calling defillama: https://coins.llama.fi/block/ethereum/${toTimestamp}`);
        defiLamaResp = await axios.get(`https://coins.llama.fi/block/ethereum/${toTimestamp}`);
        console.log('defillama resp:', defiLamaResp.data);
        const toBlock = defiLamaResp.data.height;

        if(toBlock < fromBlock) {
            res.status(400).json({error: 'toBlock must be greater than fromBlock'});
            next();
        }
        switch(platform.toLowerCase()) {
            case 'uniswapv2':
                res.json(await getUniswapAveragePriceAndLiquidity(DATA_DIR, from, to, fromBlock, toBlock));
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
