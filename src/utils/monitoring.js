const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI;

async function RecordMonitoring(monitoringData) {
    if(!uri) {
        console.log('Could not find env variable MONGODB_URI');
        return;
    }

    const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

    try {
        monitoringData['type'] = 'Dex History';
        monitoringData['lastUpdate'] = Math.round(Date.now() / 1000);
        const options = { upsert: true };
    
        const filter = {
            'type': monitoringData['type'],
            'name': monitoringData['name'],
        };

        const updateDoc = {
            $set: {...monitoringData},  
        };

        const result = await client.db('overwatch').collection('monitoring').updateOne(filter, updateDoc, options);

        console.log(`${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s), upserted ${result.upsertedCount} document(s)`);
    }
    finally {
        await client.close();
    }
}

module.exports = {RecordMonitoring};