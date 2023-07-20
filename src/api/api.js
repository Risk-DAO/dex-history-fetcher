const express = require('express');
const fs = require('fs');
const { getCurvePriceAndLiquidity, getAvailableCurve } = require('../curve/curve.utils');
const { getUniswapPriceAndLiquidity, getUniswapAveragePriceAndLiquidity, getAvailableUniswapV2 } = require('../uniswap.v2/uniswap.v2.utils');
var cors = require('cors');
var path = require('path');
const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { roundTo } = require('../utils/utils');
const app = express();
app.use(cors());
const port = process.env.API_PORT || 3000;
const DATA_DIR = process.cwd() + '/data';

const cache = {};
const cacheDuration = 30 * 60 * 1000; // 30 min cache duration

// getprecomputeddata?platform=uniswapv2&span=1
app.get('/api/getprecomputeddata', async (req, res, next) => {
    try {
        // console.log('received getprecomputeddata request', req);
        const platform = req.query.platform;
        const span = Number(req.query.span);

        if (!span || !platform) {
            res.status(400).json({ error: 'span and platform required' });
            next();
        }

        const fileName = `concat-${span}d.json`;
        const cacheKey = `concat_${platform}_${span}`;
        if (!cache[cacheKey]
            || cache[cacheKey].cachedDate < Date.now() - cacheDuration) {
            const filePath = path.join(DATA_DIR, 'precomputed', platform, fileName);
            console.log(`try reading file ${filePath}`);
            if (!fs.existsSync(filePath)) {
                console.log(`${filePath} does not exists`);
                res.status(404).json({ error: 'file does not exist' });
                return;
            }
            else {
                console.log(`${filePath} exists, saving data to cache`);
                cache[cacheKey] = {
                    data: JSON.parse(fs.readFileSync(filePath)),
                    cachedDate: Date.now(),
                };
            }
        } else {
            const cacheRemaining = cacheDuration - (Date.now() - cache[cacheKey].cachedDate);
            console.log(`returning key ${cacheKey} from cache. Cache remaining duration ${roundTo(cacheRemaining/1000, 2)} seconds`);
        }

        res.json(cache[cacheKey]);
    } catch (error) {
        next(error);
    }
});

// getprecomputeddata?platform=uniswapv2&span=1
app.get('/api/getaveragedata', async (req, res, next) => {
    try {
        // console.log('received getaveragedata request', req);
        const platform = req.query.platform;
        const span = Number(req.query.span);

        if (!span || !platform) {
            res.status(400).json({ error: 'span and platform required' });
            next();
        }

        const fileName = `averages-${span}d.json`;
        const cacheKey = `averages_${platform}_${span}`;
        if (!cache[cacheKey]
            || cache[cacheKey].cachedDate < Date.now() - cacheDuration) {
            const filePath = path.join(DATA_DIR, 'precomputed', platform, fileName);
            console.log(`try reading file ${filePath}`);
            if (!fs.existsSync(filePath)) {
                console.log(`${filePath} does not exists`);
                res.status(404).json({ error: 'file does not exist' });
                return;
            }
            else {
                console.log(`${filePath} exists, saving data to cache`);
                cache[cacheKey] = {
                    data: JSON.parse(fs.readFileSync(filePath)),
                    cachedDate: Date.now(),
                };
            }
        } else {
            const cacheRemaining = cacheDuration - (Date.now() - cache[cacheKey].cachedDate);
            console.log(`returning key ${cacheKey} from cache. Cache remaining duration ${roundTo(cacheRemaining/1000, 2)} seconds`);
        }

        res.json(cache[cacheKey]);
    } catch (error) {
        next(error);
    }
});

app.get('/api/available', (req, res) => {
    const available = {};
    available['uniswapv2'] = getAvailableUniswapV2(DATA_DIR);
    available['curve'] = getAvailableCurve(DATA_DIR);

    res.json(available);
});

// getprice?platform=uniswapv2&from=ETH&to=USDC&timestamp=1658171864&poolName=3pool
app.get('/api/getprice', async (req, res, next) => {
    try {
        // console.log('received getprice request', req);
        const platform = req.query.platform;
        const from = req.query.from;
        const to = req.query.to;
        const timestamp = Number(req.query.timestamp);

        if (!timestamp) {
            res.status(400).json({ error: 'timestamp required' });
            next();
        }

        // get nearest blocknum from defillama
        const blockNumber = await getBlocknumberForTimestamp(timestamp);

        switch (platform.toLowerCase()) {
            case 'uniswapv2':
                res.json(await getUniswapPriceAndLiquidity(DATA_DIR, from, to, blockNumber));
                break;
            case 'curve':
            {
                const poolName = req.query.poolName;
                if (!poolName) {
                    res.status(400).json({ error: 'poolName required for curve' });
                    next();
                }
                res.json(await getCurvePriceAndLiquidity(DATA_DIR, poolName, from, to, blockNumber));
                break;
            }
            default:
                res.status(400).json({ error: `Wrong platform: ${platform}` });
                break;
        }
    } catch (error) {
        next(error);
    }
});

// getprice?platform=uniswapv2&from=ETH&to=USDC&fromTimestamp=10008555&toTimestamp=11000000
app.get('/api/getaverageprice', async (req, res, next) => {
    try {
        // console.log('received getaverageprice request', req);
        const platform = req.query.platform;
        const from = req.query.from;
        const to = req.query.to;
        const fromTimestamp = Number(req.query.fromTimestamp);
        const toTimestamp = Number(req.query.toTimestamp);

        // get nearest blocknum from defillama
        const fromBlock = await getBlocknumberForTimestamp(fromTimestamp);
        const toBlock = await getBlocknumberForTimestamp(toTimestamp);

        if (toBlock < fromBlock) {
            res.status(400).json({ error: 'toBlock must be greater than fromBlock' });
            next();
        }
        switch (platform.toLowerCase()) {
            case 'uniswapv2':
                res.json(await getUniswapAveragePriceAndLiquidity(DATA_DIR, from, to, fromBlock, toBlock));
                break;
            default:
                res.status(400).json({ error: `Wrong platform: ${platform}` });
                break;
        }
    } catch (error) {
        next(error);
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});

