const dotenv = require('dotenv');
const path = require('path');
const { fnName, retry, getDay } = require('../utils/utils');
const fs = require('fs');
dotenv.config();
const { readFile } = require('fs/promises');
const compoundV3Computer = require("./compoundV3/compoundV3Computer");
const DATA_DIR = process.cwd() + '/data';


async function main() {
    console.log("launching CLFs Runner");
    await compoundV3Computer();
    console.log("unifying all the protocols files");
    const toWrite = unifyFiles();
    console.log("writing global file");
    recordResults(toWrite);
    console.log("global file written, CLF runner stopping.")
}


function unifyFiles() {
    const date = getDay();
    const folderPath = DATA_DIR + "/clf/" + date;
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
    const unifiedFullFilename = path.join(DATA_DIR, `clf/${date}/${date}_all_CLFs.json`);
    const objectToWrite = JSON.stringify(results);
    try {
        fs.writeFileSync(unifiedFullFilename, objectToWrite, 'utf8');
    }
    catch (error) {
        console.log(error);
    }
}

main();