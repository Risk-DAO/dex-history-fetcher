const { exec } = require('child_process');
const { getAvailableCurve } = require('../src/curve/curve.utils');
const { sleep } = require('../src/utils/utils');

async function multicurve() {
    const available = getAvailableCurve('./data');

    for(const base of Object.keys(available)) {
        for(const quote of Object.keys(available[base])) {
            
            for(const pool of Object.keys(available[base][quote])) {
                exec(`node ./scripts/simpleCurve.js ${19000000} ${base} ${quote} ${pool}`);
                await sleep(10000);
            }
        }
    }
}

multicurve();