const { getDay } = require('../utils/utils');
const DATA_DIR = process.cwd() + '/data';
const path = require('path');
const fs = require('fs');

function jsDateToString(date) {
    const dateObj = date;
    const month = dateObj.getUTCMonth() + 1; //months from 1-12
    const day = dateObj.getUTCDate();
    const year = dateObj.getUTCFullYear();
    return day + '.' + month + '.' + year;
}


function unifyProtocolData(protocol) {
    let numberOfDaysAccumulated = 0;
    let currentDay = new Date();
    const protocolData = {};
    while (numberOfDaysAccumulated < 180) {
        //opening latest protocol file
        const day = jsDateToString(currentDay);
        const folderPath = DATA_DIR + '/clf/' + day;
        const fileName = `${day}_${protocol}_CLFs.json`;
        const filePath = path.join(folderPath, fileName);
        try {
            const contents = fs.readFileSync(filePath, 'utf8');
            const latestData = JSON.parse(contents);
            for (const [market, marketData] of Object.entries(latestData.results)) {
                if (!protocolData[market]) {
                    protocolData[market] = {};
                }
                for (const [collateral, collateralValues] of Object.entries(marketData.data)) {
                    if (!protocolData[market][collateral] && collateralValues) {
                        protocolData[market][collateral] = {};
                    }
                    if (collateralValues) {
                        protocolData[market][collateral][day] = collateralValues.clfs;
                    }
                }
            }
        }
        catch (error) {
            console.log(error);
            console.log('Number of days accumulated', numberOfDaysAccumulated);
            break;
        }
        currentDay.setDate(currentDay.getDate() - 1);
        numberOfDaysAccumulated++;
    }
    return { protocolData, numberOfDaysAccumulated };
}

function computeAveragesForProtocol(protocolData, numberOfDaysAccumulated) {
    const toAverage = {};
    for (const [market, marketData] of Object.entries(protocolData)) {
        if (!toAverage[market]) {
            toAverage[market] = {};
        }
        for (const [collateral, collateralValues] of Object.entries(marketData)) {
            if (!toAverage[market][collateral]) {
                toAverage[market][collateral] = {};
            }
            for (const [days, volatilitySpan] of Object.entries(collateralValues)) {
                for (const [volSpan, liquiditySpan] of Object.entries(volatilitySpan)) {
                    if (!toAverage[market][collateral][volSpan]) {
                        toAverage[market][collateral][volSpan] = {};
                    }
                    for (const [liqSpan, liquidityValue] of Object.entries(liquiditySpan)) {
                        if (!toAverage[market][collateral][volSpan][liqSpan]) {
                            toAverage[market][collateral][volSpan][liqSpan] = 0;
                        }
                        toAverage[market][collateral][volSpan][liqSpan].push(liquidityValue);
                    }
                }
            }
        }
    }
    const averaged = {};
    let daysAveraged = 0;
    while(daysAveraged < 180){
        for (const [market, collaterals] of Object.entries(toAverage)) {
            if (!averaged[market]) {
                averaged[market] = {};
            }
            for (const [collateral, collateralValues] of Object.entries(collaterals)) {
                if (!averaged[market][collateral]) {
                    averaged[market][collateral] = {};
                }
                for (const [vol, liqArray] of Object.entries(collateralValues)) {
                    console.log('vol', vol);
                    console.log('liqArray', liqArray); 
                    daysAveraged++;
                }
            }
        }
    }
    return averaged;
}

function main(protocol) {
    const { protocolData, numberOfDaysAccumulated } = unifyProtocolData(protocol);
    const averagesToWrite = computeAveragesForProtocol(protocolData, numberOfDaysAccumulated);
    console.log(JSON.stringify(averagesToWrite));
}


main('compoundv3');