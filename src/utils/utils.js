const dotenv = require('dotenv');
dotenv.config();

// various utils fct


/**
 * round a number to 'dec' decimals
 * @param {number} num to round
 * @param {number} dec how many decimals
 * @returns 
 */
function roundTo(num, dec = 2) {
    const pow = Math.pow(10, dec);
    return Math.round((num + Number.EPSILON) * pow) / pow;
}

/**
 * get caller function name
 * @returns caller name
 */
function fnName() {
    return fnName.caller.name;
}

/**
 * Logs the duration of a function
 * @param {number} dtStart unix timestamp ms
 * @param {number} jobCount the number of job done, to be displayed as nbjob/sec if set
 * @param {number} jobName the name for the jobs done
 */
function logFnDuration(dtStart, jobCount = undefined, jobName = 'job') {
    if(!process.env.DEBUG_DURATION) return;
    const secDuration = (Date.now() - dtStart)/1000;
    if(jobCount) {
        console.log(`${logFnDuration.caller.name} duration: ${roundTo(secDuration)} s. ${jobCount/secDuration} ${jobName}/sec`);
    } else {
        console.log(`${logFnDuration.caller.name} duration: ${roundTo(secDuration)} s`);
    }
}
/**
 * 
 * @param {number} ms milliseconds to sleep 
 * @returns async promise
 */
async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * a small retry wrapper with an incrameting 5s sleep delay
 * @param {Function} fn 
 * @param {*[]} params 
 * @param {number} retries 
 * @returns 
 */
async function retry(fn, params, retries = 0) {
    try {
        const res = await  fn(...params);
        if(retries){
            console.log(`retry success after ${retries} retries`);
        } else {
            // console.log('success on first try');
        }
        return res;
    } catch (e) {
        console.error(e);
        retries++;
        console.log(`retry #${retries}`);
        await sleep(5000 * retries);
        return retry(fn, params, retries);
    }
}

module.exports = { retry, sleep, fnName, roundTo, logFnDuration };