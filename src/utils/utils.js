// various utils fct

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

module.exports = { retry, sleep };