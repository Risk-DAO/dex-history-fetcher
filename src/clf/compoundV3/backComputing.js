const { DATA_DIR } = require('../../utils/constants');
const { getDay, sleep } = require('../../utils/utils');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const maxThreads = os.availableParallelism();

async function backComputing() {
    console.log({maxThreads});

    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const endDate = new Date();
    const allChilds = [];

    while (startDate <= endDate) {
        // wait for less than 10 scripts running
        let nbThreadRunning = allChilds.filter(_ => _.exitCode == null).length;
        console.log(`subProcess running: ${nbThreadRunning}/${maxThreads}`);
        while(nbThreadRunning >= maxThreads) {
            await sleep(30000);
            console.log(`Waiting for a subProcess to end. | Running: ${nbThreadRunning}/${maxThreads}`);
            nbThreadRunning = allChilds.filter(_ => _.exitCode == null).length;
        }

        const currDay = getDay(startDate);
        if (!fs.existsSync(`${DATA_DIR}/clf/${currDay}`)) {
            console.log(`fetching ${startDate} data`);
            const cmd = `node ./src/clf/compoundV3/compoundV3ComputerLauncher.js ${startDate.getTime()}`;
            console.log(`starting cmd: ${cmd}`);
            const childProcess = exec(cmd);
            childProcess.stderr.on('data', function(data) {
                console.log(data); 
            });

            allChilds.push(childProcess);
            await sleep(15000);
        }
        if (fs.existsSync(`${DATA_DIR}/clf/${currDay}`)) {
            console.log('data already fetched');
        }
        
        startDate.setDate(startDate.getDate() + 1);
    }

    let mustWait = allChilds.filter(_ => _.exitCode == null).length > 0;
    while(mustWait) {
        await sleep(10000);
        const subProcessStillRunningCount = allChilds.filter(_ => _.exitCode == null).length;
        console.log(`Waiting for all subProcess to end. ${subProcessStillRunningCount}/${allChilds.length} still running`);
        mustWait = subProcessStillRunningCount > 0;
    }
}


backComputing();    