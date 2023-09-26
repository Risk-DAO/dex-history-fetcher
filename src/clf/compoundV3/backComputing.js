const { DATA_DIR } = require('../../utils/constants');
const { getDay } = require('../../utils/utils');
const { compoundV3Computer } = require('./compoundV3Computer');
const fs = require('fs');



async function backComputing() {
    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    let condition = startDate;
    while (condition <= endDate) {
        const currDay = getDay(condition);
        if (!fs.existsSync(`${DATA_DIR}/clf/${currDay}`)) {
            console.log(`fetching ${condition} data`);
            await compoundV3Computer(0, condition);
        }
        if (fs.existsSync(`${DATA_DIR}/clf/${currDay}`)) {
            console.log('data already fetched');
        }
        
        condition.setDate(condition.getDate() + 1);
    }
}


backComputing();    