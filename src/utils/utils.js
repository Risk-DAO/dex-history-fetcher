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

module.exports = { retry, sleep, fnName, roundTo };