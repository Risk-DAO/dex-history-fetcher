const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.API_URI;
let monitoringEnabled = true; // default to true
if (process.env.MONITORING) {
    monitoringEnabled = process.env.MONITORING == 'true';
}

async function RecordMonitoring(monitoringData) {
    if (!monitoringEnabled) {
        return;
    }

    if (!uri) {
        console.log('Could not find env variable API_URI');
        return;
    }

    try {
        monitoringData['type'] = 'Dex History';
        monitoringData['lastUpdate'] = Math.round(Date.now() / 1000);
        const resp = await axios.post(uri, monitoringData);
        console.log(resp.data);
    } catch (error) {
        console.log('error when pushing monitoring', error);
    }
}

// RecordMonitoring({
//     'name': 'testDex',
//     'status': 'success',
//     'lastStart': '1685959134',
//     'lastEnd': '1685959194',
//     'lastDuration': '12',
//     'lastUpdate': '1685959194',
//     'error': 'undefined',
//     'runEvery': '100000000'
// });

module.exports = { RecordMonitoring };