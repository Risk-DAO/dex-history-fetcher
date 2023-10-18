const { compoundV3Computer } = require('./compoundV3Computer');

async function ComputeCompoundV3ForDate() {
    process.exitCode = 0;
    const startDateMs = Number(process.argv[2]);
    if(!startDateMs) {
        throw new Error(`Cannot work with date: ${startDateMs}`);
    }

    const startDate = new Date(startDateMs);
    try {
        await compoundV3Computer(0, startDate);
    } catch(e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
    
}

ComputeCompoundV3ForDate();