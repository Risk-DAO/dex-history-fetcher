const dotenv = require('dotenv');
const path = require('path');
const { getDay, fnName, roundTo, sleep } = require('../utils/utils');
const fs = require('fs');
dotenv.config();
const { computeAveragesForProtocol } = require('./computeAveragesForProtocol');
const { DATA_DIR } = require('../utils/constants');
const { CLFsConfig } = require('./CLFs.config');
const { computeCLFHistoryForProtocol } = require('./computeCLFHistoryForProtocol');

async function main() {
    const start = Date.now();
    const fetchEveryMinutes = 1440;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        console.log('launching CLFs Runner');
        for (const protocol of CLFsConfig) {
            await protocol.toLaunch(fetchEveryMinutes);
            console.log(`computing averages data for ${protocol.name}`);
            const averagesData = computeAveragesForProtocol(protocol.name);
            console.log('writing average data file');
            recordResults(averagesData, `${protocol.name}_average_CLFs`);
            console.log('organizing graph data');
            const graphData = computeCLFHistoryForProtocol(protocol.name);
            console.log('writing graphData file');
            recordResults(graphData, `${protocol.name}_graphData`);

        }
        console.log('unifying all the protocols files');
        const toWrite = unifyFiles();
        console.log('writing global file');
        recordResults(toWrite, 'all_CLFs');
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
    const folderPath = path.join(DATA_DIR, 'clf', date);
    const toWrite = [];
    try {
        const files = fs.readdirSync(folderPath);
        files.forEach(file => {
            if (!file.includes('average') && !file.includes('all_CLFs')) {
                const filePath = path.join(folderPath, file);
                const contents = fs.readFileSync(filePath, 'utf8');
                toWrite.push(JSON.parse(contents));
            }
        });
        return toWrite;
    }
    catch (error) {
        console.log(error);
    }

}

function recordResults(results, name) {
    const date = getDay();
    if (!fs.existsSync(`${DATA_DIR}/clf/${date}`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/${date}`);
    }
    if (!fs.existsSync(`${DATA_DIR}/clf/latest`)) {
        fs.mkdirSync(`${DATA_DIR}/clf/latest`);
    }
    const unifiedFullFilename = path.join(DATA_DIR, `clf/${date}/${date}_${name}.json`);
    const latestUnifiedFullFilename = path.join(DATA_DIR, `clf/latest/${name}.json`);
    const objectToWrite = JSON.stringify(results, null, 2);
    try {
        fs.writeFileSync(unifiedFullFilename, objectToWrite, 'utf8');
        fs.writeFileSync(latestUnifiedFullFilename, objectToWrite, 'utf8');
    }
    catch (error) {
        console.log(error);
    }
}

main();