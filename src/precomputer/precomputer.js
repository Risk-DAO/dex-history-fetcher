const { getUniV2DataforBlockRange } = require('../uniswap.v2/uniswap.v2.utils');
const fs = require('fs');
const DATA_DIR = process.cwd() + '/data';
const dataPointsCount = process.env.DATAPOINTS_COUNT_PER_DAY || 50;
const blocksPerDay = process.env.BLOCKS_PER_DAY || 7105;

function getAvailableUniswapV2() {
    const available = [];
    const files = fs.readdirSync(`${DATA_DIR}/uniswapv2/`).filter(_ => _.endsWith('.csv'));
    for(const file of files) {
        available.push(file);
    }

    return available;
}

async function main(days) {
    const blockStep = Number(blocksPerDay) / Number(dataPointsCount);
    const blocksToFetch = Number(dataPointsCount) * Number(days);
    const files = getAvailableUniswapV2();

    for(const file of files){
        console.log('-------------------------------');
        console.log('PreComputer: starting on file', file);
        const filePath = DATA_DIR + '/uniswapv2/' + file;
        console.log(filePath);

        // We read the last line to get the lastData
        const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');
        // read last line
        let lastLine = fileContent[fileContent.length - 1]; 
        if(!lastLine) {
            // last line can be just \n so if lastline empty, check previous line
            lastLine = fileContent[fileContent.length - 2]; 
        }
        const lastBlockDataSplt = lastLine.split(',');
        const lastBlockNumber = Number(lastBlockDataSplt[0]);
        console.log(lastBlockNumber);
        for(let i = 0; i < blocksToFetch; i++){
            
        }

    }



    const results = await getUniV2DataforBlockRange('data', 'eth', 'usdc', [16648878, 16648838]);
    console.log(results);
}


main();