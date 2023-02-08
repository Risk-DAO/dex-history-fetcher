const curveConfig = require('./curve.config');
const { FetchHistory } = require('./curve.history.fetcher');




async function main() {
    for (let i = 0; i < 1; i++) {
        await FetchHistory(curveConfig.curvePairs[i]);
    }
}


main();