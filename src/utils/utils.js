const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

// various utils fct

/**
 * Read the last line of a file, without reading full file
 * @param {string} file filepath
 * @returns 
 */
async function readLastLine(file) {
    const fileSize = (await fs.promises.stat(file)).size;
    const bufferSize = 1024 * 1024;
    let lastLine = '';
    let bytesRead = 0;
    let fileOffset = fileSize - bufferSize;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const start = Math.max(fileOffset, 0);
        const stream = fs.createReadStream(file, {
            start: start,
            highWaterMark: bufferSize,
        });
        bytesRead = 0;

        for await (const chunk of stream) {
            let i = chunk.length - 1;
            for (; i >= 0; --i) {
                if (chunk[i] === 10) { // '\n'
                    lastLine = chunk.slice(i + 1).toString('utf8') + lastLine;

                    // don't return last empty line
                    if(lastLine.trim()) {
                        return lastLine.trim();
                    }
                }
            }

            lastLine = chunk.toString('utf8') + lastLine;
            bytesRead += chunk.length;
        }
        fileOffset -= bytesRead;
        if (fileOffset < 0) {
            return lastLine;
        }
    }
}

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
        console.log(`${logFnDuration.caller.name} duration: ${roundTo(secDuration, 6)} s. ${jobCount/secDuration} ${jobName}/sec`);
    } else {
        console.log(`${logFnDuration.caller.name} duration: ${roundTo(secDuration, 6)} s`);
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

const getDay = () => {
    const dateObj = new Date();
    const month = dateObj.getUTCMonth() + 1; //months from 1-12
    const day = dateObj.getUTCDate();
    const year = dateObj.getUTCFullYear();
    return day + '.' + month + '.' + year
  }

/**
 * a small retry wrapper with an incremeting 5s sleep delay
 * @param {Function} fn 
 * @param {*[]} params 
 * @param {number} retries 
 * @param {number} maxRetries 
 * @returns 
 */
async function retry(fn, params, retries = 0, maxRetries = 10) {
    try {
        const res = await fn(...params);
        if(retries){
            console.log(`retry success after ${retries} retries`);
        } else {
            // console.log('success on first try');
        }
        return res;
    } catch (e) {
        console.error(e);
        retries++;
        if(retries >= maxRetries) {
            throw e;
        }
        console.log(`retry #${retries}`);
        await sleep(5000 * retries);
        return retry(fn, params, retries);
    }
}

module.exports = { retry, sleep, fnName, getDay, roundTo, logFnDuration, readLastLine };
