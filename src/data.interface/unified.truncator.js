const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('../utils/constants');
const { getBlocknumberForTimestamp } = require('../utils/web3.utils');
const { retrySync } = require('../utils/utils');

/**
 * Truncate all unified files for a platform, keeping only data after 'oldestBlockToKeep'
 * @param {string} platform 
 * @param {number} oldestBlockToKeep 
 */
function truncateUnifiedFiles(platform, oldestBlockToKeep) {
    const dirPath = path.join(DATA_DIR, 'precomputed', platform);
    const allUnifiedFilesForDirectory = fs.readdirSync(dirPath).filter(_ => _.endsWith('unified-data.csv'));
    
    for(const unifiedFileToProcess of allUnifiedFilesForDirectory) {
        console.log(`truncateUnifiedFiles: working on ${unifiedFileToProcess}`);
        const linesToKeep = [];
        linesToKeep.push('blocknumber,price,slippagemap\n');
        const linesToProcess = fs.readFileSync(path.join(dirPath, unifiedFileToProcess), 'utf-8').split('\n');
        let deletedLines = 0;
        for(let i = 1; i < linesToProcess.length - 1; i++) {
            const lineToProcess = linesToProcess[i];
            if(lineToProcess) {
                const blockNumber = Number(lineToProcess.split(',')[0]);
                if(blockNumber > oldestBlockToKeep) {
                    linesToKeep.push(lineToProcess + '\n');
                } else {
                    deletedLines++;
                }
            }
        }

        if(deletedLines == 0) {
            console.log(`truncateUnifiedFiles: no data to be truncated from ${unifiedFileToProcess}`)
            continue;
        }
        
        const stagingFilepath = path.join(dirPath, unifiedFileToProcess + '-staging');
        fs.writeFileSync(stagingFilepath, linesToKeep.join(''));
        console.log(`truncateUnifiedFiles: ${unifiedFileToProcess} will be truncated from ${linesToProcess.length} to ${linesToKeep.length} lines`);
        retrySync(replaceFile, [path.join(dirPath, unifiedFileToProcess), stagingFilepath], 0, 10000);
    }
}

function replaceFile(oldFileFullPath, newFileFullPath) {
    fs.renameSync(newFileFullPath, oldFileFullPath);
}

module.exports = { truncateUnifiedFiles };

// async function test() {
//     const blockLastYear = await getBlocknumberForTimestamp(Math.round(Date.now()/1000) - 365 * 24 * 60 * 60);
//     truncateUnifiedFiles('sushiswapv2', blockLastYear);
// }

// test();