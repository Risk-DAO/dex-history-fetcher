const { sleep } = require('../utils/utils');
const curveConfig = require('./curve.config');
const { FetchHistory } = require('./curve.history.fetcher');




async function main() {
    const errors = [];


    for (let i = 0; i < curveConfig.curvePairs.length; i++) {
        try {
            await FetchHistory(curveConfig.curvePairs[i]);
        }
        catch (error) {
            errors.push(curveConfig.curvePairs[i].poolName);
            console.log('error fetching pool', curveConfig.curvePairs[i].poolName);
            console.log('error fetching pool', error);
        }
        await sleep(5000);
    }
    console.log('errorlog', errors);

}



main();