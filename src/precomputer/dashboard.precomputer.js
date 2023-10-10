const { RecordMonitoring } = require('../utils/monitoring');
const { ethers } = require('ethers');
const { fnName, roundTo, sleep } = require('../utils/utils');
const { dashboardPairsToCompute } = require('./precomputer.config');
const { DATA_DIR, PLATFORMS } = require('../utils/constants');
const RUN_EVERY_MINUTES = 3 * 60; // in minutes
const MONITORING_NAME = 'Dashboard Precomputer';
const RPC_URL = process.env.RPC_URL;
const fs = require('fs');
const path = require('path');
const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { getLiquidity, getLiquidityAllPlatforms } = require('../data.interface/data.interface');

const web3Provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL);
const TARGET_DATA_POINTS = 200;
const NB_DAYS = 180;

async function PrecomputeDashboardData() {
// eslint-disable-next-line no-constant-condition
    while(true) {
        const runStartDate = Date.now();
        try {
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'running',
                'lastStart': Math.round(runStartDate/1000),
                'runEvery': RUN_EVERY_MINUTES * 60
            });

            const currentBlock = await web3Provider.getBlockNumber() - 100;

            const daysAgo = Math.round(Date.now()/1000) - NB_DAYS * 24 * 60 * 60;
            const startBlock =  await getBlocknumberForTimestamp(daysAgo);
            const blockStep = Math.round((currentBlock - startBlock) / TARGET_DATA_POINTS);

            const dirPath = path.join(DATA_DIR, 'precomputed', 'dashboard');
            if(!fs.existsSync(path.join(DATA_DIR, 'precomputed', 'dashboard'))) {
                fs.mkdirSync(dirPath);
            }

            for(const pair of dashboardPairsToCompute) {
                console.log(`${fnName()}: precomputing for pair ${pair.base}/${pair.quote}`);
                for(const platform of PLATFORMS) {
                    console.log(`${fnName()}[${pair.base}/${pair.quote}]: precomputing for platform ${platform}`);
                    const platformLiquidity = getLiquidity(platform, pair.base, pair.quote, startBlock, currentBlock, true, blockStep);
                    if(platformLiquidity) {
                        const fullFilename = path.join(dirPath, `${pair.base}-${pair.quote}-${platform}.json`);
                        fs.writeFileSync(fullFilename, JSON.stringify(platformLiquidity));
                    }
                }

                // then also do for all
                const allLiquidity = getLiquidityAllPlatforms(pair.base, pair.quote, startBlock, currentBlock, true, blockStep);
                if(allLiquidity) {
                    const fullFilename = path.join(dirPath, `${pair.base}-${pair.quote}-all.json`);
                    fs.writeFileSync(fullFilename, JSON.stringify(allLiquidity));
                }
            }

            const runEndDate = Math.round(Date.now() / 1000);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'success',
                'lastEnd': runEndDate,
                'lastDuration': runEndDate - Math.round(runStartDate / 1000)
            });
    
            const sleepTime = RUN_EVERY_MINUTES * 60 * 1000 - (Date.now() - runStartDate);
            if(sleepTime > 0) {
                console.log(`${fnName()}: sleeping ${roundTo(sleepTime/1000/60)} minutes`);
                await sleep(sleepTime);
            }
        } catch(error) {
            console.error(error);
            const errorMsg = `An exception occurred: ${error}`;
            console.log(errorMsg);
            await RecordMonitoring({
                'name': MONITORING_NAME,
                'status': 'error',
                'error': errorMsg
            });

            console.log('sleeping 10 minutes');
            await sleep(10 * 60 * 1000);
        }

        
    }

}

PrecomputeDashboardData();