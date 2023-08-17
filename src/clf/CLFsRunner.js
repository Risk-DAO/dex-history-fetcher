const dotenv = require('dotenv');
const path = require('path');
const { getDay, fnName, roundTo, sleep } = require('../utils/utils');
const fs = require('fs');
dotenv.config();
const {compoundV3Computer} = require('./compoundV3/compoundV3Computer');
const DATA_DIR = process.cwd() + '/data';


async function main() {
    const start = Date.now();
    const fetchEveryMinutes = 1440;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        console.log('launching CLFs Runner');
        await compoundV3Computer(fetchEveryMinutes);
        console.log('unifying all the protocols files');
        const toWrite = unifyFiles();
        console.log('writing global file');
        recordResults(toWrite);
        console.log('global file written, CLF runner stopping.');
        const sleepTime = fetchEveryMinutes * 60 * 1000 - (Date.now() - start);
        if (sleepTime > 0) {
            console.log(`${fnName()}: sleeping ${roundTo(sleepTime / 1000 / 60)} minutes`);
            await sleep(sleepTime);
        }
    }
}


function unifyFiles() {
    const date = getDay();
    const folderPath = DATA_DIR + '/clf/' + date;
    const toWrite = [];
    try {
        const files = fs.readdirSync(folderPath);
        files.forEach(file => {
            const filePath = path.join(folderPath, file);
            const contents = fs.readFileSync(filePath, 'utf8');
            toWrite.push(JSON.parse(contents));
        })
        return toWrite;
    }
    catch (error) {
        console.log(error);
    }

}

function recordResults(results) {
    const date = getDay();
    if (!fs.existsSync(`${DATA_DIR}/clf/${date}`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/${date}`);
    }
    if (!fs.existsSync(`${DATA_DIR}/clf/latest`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/latest`);
    }
    const unifiedFullFilename = path.join(DATA_DIR,  `clf/${date}/${date}_all_CLFs.json`);
    const latestUnifiedFullFilename = path.join(DATA_DIR, 'clf/latest/all_CLFs.json');
    const objectToWrite = JSON.stringify(results);
    try {
        fs.writeFileSync(unifiedFullFilename, objectToWrite, 'utf8');
        fs.writeFileSync(latestUnifiedFullFilename, objectToWrite, 'utf8');
    }
    catch (error) {
        console.log(error);
    }
}

main();