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
                for (const [collateral, collateralValues] of Object.entries(marketData.collateralsData)) {
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

function computeAverages(protocolData, numberOfDaysAccumulated) {
    const toAverage = {};
    const averaged = {};
    try {
        for (const [market, marketData] of Object.entries(protocolData)) {
            if (!toAverage[market]) {
                toAverage[market] = {};
            }
            for (const [collateral, collateralValues] of Object.entries(marketData)) {
                if (!toAverage[market][collateral]) {
                    toAverage[market][collateral] = {};
                }
                let daysAveraged = 0;
                for (const volatilitySpan of Object.values(collateralValues)) {
                    daysAveraged++;
                    for (const [volSpan, liquiditySpan] of Object.entries(volatilitySpan)) {
                        if (!toAverage[market][collateral][volSpan]) {
                            toAverage[market][collateral][volSpan] = {};
                        }
                        for (const [liqSpan, liquidityValue] of Object.entries(liquiditySpan)) {
                            if (daysAveraged === 7 || daysAveraged === 30 || daysAveraged === 180 || daysAveraged === numberOfDaysAccumulated) {
                                if (!averaged[market]) {
                                    averaged[market] = {};
                                }
                                if (!averaged[market][collateral]) {
                                    averaged[market][collateral] = {};
                                }
                                if (!averaged[market][collateral][`${daysAveraged}D_averageSpan`]) {
                                    averaged[market][collateral][`${daysAveraged}D_averageSpan`] = {};
                                }
                                if (!averaged[market][collateral][`${daysAveraged}D_averageSpan`][volSpan]) {
                                    averaged[market][collateral][`${daysAveraged}D_averageSpan`][volSpan] = {};
                                }
                                if (!averaged[market][collateral][`${daysAveraged}D_averageSpan`][volSpan][liqSpan]) {
                                    averaged[market][collateral][`${daysAveraged}D_averageSpan`][volSpan][liqSpan] = toAverage[market][collateral][volSpan][liqSpan] / daysAveraged;
                                }
                            }
                            if (!toAverage[market][collateral][volSpan][liqSpan]) {
                                toAverage[market][collateral][volSpan][liqSpan] = 0;
                            }
                            toAverage[market][collateral][volSpan][liqSpan] += liquidityValue;
                        }
                    }
                }
            }
        }
    }
    catch (error) {
        console.log(error);
    }
    return averaged;
}

function computeAveragesForProtocol(protocol) {
    const { protocolData, numberOfDaysAccumulated } = unifyProtocolData(protocol);
    const averagesToWrite = computeAverages(protocolData, numberOfDaysAccumulated);
    return averagesToWrite;
}


module.exports = { computeAveragesForProtocol };
