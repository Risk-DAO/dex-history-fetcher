const axios = require('axios');

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
        await axios.post(`${uri}/push`, monitoringData)
            .then((resp) => console.log(resp.data))
            .catch((error) => console.log(error));
    }
    finally {
        console.log('alerts pushed');
    }
}

module.exports = { RecordMonitoring };