const { getUniV2DataforBlockRange, computeLiquidityUniV2Pool } = require('../uniswap.v2/uniswap.v2.utils');
const fs = require('fs');
const { tokens } = require('../global.config');
const { normalize } = require('../utils/token.utils');
const DATA_DIR = process.cwd() + '/data';
const dataPointsCount = process.env.DATAPOINTS_COUNT_PER_DAY || 50;
const blocksPerDay = process.env.BLOCKS_PER_DAY || 7105;

function getAvailableUniswapV2() {
    const available = [];
    const files = fs.readdirSync(`${DATA_DIR}/uniswapv2/`).filter(_ => _.endsWith('.csv'));
    for (const file of files) {
        available.push(file);
    }
    return available;
}

function computePrice(fromSymbol, toSymbol, fromReserve, toReserve){
    const normalizedFrom = normalize(fromReserve, tokens[fromSymbol].decimals);
    const normalizedTo = normalize(toReserve, tokens[toSymbol].decimals);
    const price = normalizedTo / normalizedFrom;
    return price;
}

async function main(days = 1) {
    const blockStep = Number((Number(blocksPerDay) / Number(dataPointsCount)).toFixed(0));
    const blocksToFetch = Number(dataPointsCount) * Number(days);
    const files = getAvailableUniswapV2();
    const targetSlippage = [1, 5, 10, 15, 20];

    for (const file of files) {
        console.log('-------------------------------');
        console.log('PreComputer: starting on file', file);
        const filePath = DATA_DIR + '/uniswapv2/' + file;
        const pairIsolation = file.split('_');
        const pair = pairIsolation[0].split('-');
        const from = pair[0];
        const to = pair[1];

        // We read the last line to get the lastData
        const fileContent = fs.readFileSync(filePath, 'utf-8').split('\n');
        // read last line
        let lastLine = fileContent[fileContent.length - 1];
        if (!lastLine) {
            // last line can be just \n so if lastline empty, check previous line
            lastLine = fileContent[fileContent.length - 2];
        }
        const lastBlockDataSplt = lastLine.split(',');
        const lastBlockNumber = Number(lastBlockDataSplt[0]);
        /// creating blockrange
        const blockRange = [];
        for (let i = 0; i < blocksToFetch; i++) {
            blockRange.push(lastBlockNumber + (i * blockStep));
        }
        /// retrieve blockdata
        const results = await getUniV2DataforBlockRange('data', from, to, blockRange);
        /// compute liquidity
        const volumeForSlippage = [];
        for (const [block, value] of Object.entries(results)) {
            const liquidity = {};
            liquidity['blockNumber'] = block;
            for (let i = 0; i < targetSlippage.length; i++) {
                const normalizedFrom = normalize(value.fromReserve, tokens[from].decimals);
                const normalizedTo = normalize(value.toReserve, tokens[to].decimals);
                liquidity[targetSlippage[i]] = computeLiquidityUniV2Pool(from, normalizedFrom, to, normalizedTo, (targetSlippage[i]/100));
            }
            volumeForSlippage.push(liquidity);
        }
        // compute start and end price
        ///compute startPrice
        const startPrice = computePrice(from, to, results[blockRange[0]].fromReserve, results[blockRange[0]].toReserve);
        const endPrice = computePrice(from, to, results[blockRange.at(-1)].fromReserve, results[blockRange.at(-1)].toReserve);

        //writing data
        const preComputedData = {
            startPrice : startPrice,
            endPrice : endPrice, 
            volumeForSlippage : volumeForSlippage
        };

        fs.writeFileSync(`./data/precomputed/${from}-${to}_precomputed.json`, JSON.stringify(preComputedData));
    }
}

main();