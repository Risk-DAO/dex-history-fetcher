const { DATA_DIR } = require('../../utils/constants');
const { getDay, sleep } = require('../../utils/utils');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const maxThreads = os.availableParallelism();

async function backComputing() {
    console.log({maxThreads});

    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    startDate.setHours(12, 0, 0, 0);
    console.log(startDate.getTime());

    const endDate = new Date();
    const allChilds = [];

    while (startDate <= endDate) {
        // wait for less than 'maxThreads' scripts running
        let nbThreadRunning = allChilds.filter(_ => _.exitCode == null).length;
        console.log(`subProcess running: ${nbThreadRunning}/${maxThreads}`);
        let waitCpt = 0;
        while(nbThreadRunning >= maxThreads) {
            if(waitCpt % 12 == 0) {
                // long only every 12 wait, which is 60 seconds
                console.log(`Waiting for a subProcess to end. | Running: ${nbThreadRunning}/${maxThreads}`);
            }
            await sleep(5000);
            nbThreadRunning = allChilds.filter(_ => _.exitCode == null).length;
            waitCpt++;
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
            await sleep(10000);
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