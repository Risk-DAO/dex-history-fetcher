
const fs = require('fs');
const { normalize, getConfTokenBySymbol } = require('../src/utils/token.utils');
const path = require('path');
const dotenv = require('dotenv');
const { computeLiquidityUniV2Pool, getUniV2DataFile } = require('../src/uniswap.v2/uniswap.v2.utils');
dotenv.config();
const { getUniV3DataFiles, getUniV3DataContents } = require('../src/uniswap.v3/uniswap.v3.utils');

async function aggregUniswapDataForPair(base, quote, currentBlock) {
    console.log(`Working on ${base}/${quote}`);
            
    const baseToken = getConfTokenBySymbol(base);
    const quoteToken = getConfTokenBySymbol(quote);
    const destFilename = path.join('./nocommit/compound/univ2v3', `${baseToken.symbol}-${quoteToken.symbol}_uniswap_v2+v3.csv`);

    fs.writeFileSync(destFilename, `blocknumber,reserve ${base},reserve ${quote},volume ${base} for 5% slippage\n`);

    const allData = {};
    const univ2FileInfo = getUniV2DataFile('./data', base, quote);
    if(univ2FileInfo) {
        const fileContent = fs.readFileSync(univ2FileInfo.path, 'utf-8').split('\n');
                
        allData.univ2 = [];
        for(let i = 1; i < fileContent.length -1; i++) {
            const splt = fileContent[i].split(',');
            const block = Number(splt[0]);
            const reserveFrom = univ2FileInfo.reverse ? normalize(splt[2], baseToken.decimals) : normalize(splt[1], baseToken.decimals);
            const reserveTo = univ2FileInfo.reverse ? normalize(splt[1], quoteToken.decimals): normalize(splt[2], quoteToken.decimals);

            const liquidity5Pct = computeLiquidityUniV2Pool(reserveFrom, reserveTo, 5/100);
            allData.univ2.push({
                block: block,
                volumeForSlippage: liquidity5Pct
            });
        }
    } else {
        console.log(`no univ2 data file for ${base}/${quote}`);
    }

    const univ3DataFiles = getUniV3DataFiles('./data', base, quote);

    const univ3Files = univ3DataFiles.selectedFiles;
    if(univ3Files.length > 0) {
        const univ3Data = getUniV3DataContents(univ3Files, './data');
                
        for(const filename of Object.keys(univ3Data)) {
            console.log(filename);
            allData[`univ3-${filename}`] = [];

            for(const [blocknumber, dataObj] of Object.entries(univ3Data[filename])) {

                const slippageObj = dataObj[`${base}-slippagemap`];
                let slippage5Pct = slippageObj['5'];
                if(slippage5Pct == undefined) {
                    slippage5Pct = slippageObj['4'];
                }
                allData[`univ3-${filename}`].push({
                    block: blocknumber,
                    volumeForSlippage: slippage5Pct
                });
            }
        }
    } else {
        console.log(`no univ3 data file for ${base}/${quote}`);
    }

    if(Object.keys(allData) == 0) {
        console.log(`No files at all found for ${base}/${quote}`);
        return;
    }

    // here, allData have all the data we need to work
    // first we will find the first block where there is data and then go from there
    // using a step of 150 blocks to generate the destination file
    // let oldestBlock = Number.MAX_SAFE_INTEGER;
    // for(const [key, value] of Object.entries(allData)) {
    //     if(oldestBlock > value[0].block) {
    //         console.log(`oldest block comes from ${key}`);
    //         oldestBlock = value[0].block;
    //     }
    // }

    let toWrite = [];
    for(let block = 10000000; block <= currentBlock; block += 150) {
        let volume = 0;
        for(const [key, value] of Object.entries(allData)) {
            const nearestValueBefore = value.filter(_ => _.block <= block).at(-1);
            // console.log(`found nearest value for block ${block} for ${key}:`, nearestValueBefore);

            if(nearestValueBefore) {
                volume += nearestValueBefore.volumeForSlippage;
            }
        }
        toWrite.push(`${block},0,0,${volume}\n`);
        if(toWrite.length >= 10000) {
            fs.appendFileSync(destFilename, toWrite.join(''));
            toWrite = [];
        }
    }

    fs.appendFileSync(destFilename, toWrite.join(''));
}

aggregUniswapDataForPair(process.argv[2], process.argv[3], Number(process.argv[4]));