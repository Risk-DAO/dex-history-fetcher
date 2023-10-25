const { compoundV3Computer } = require('./compoundV3Computer');

async function compoundV3ComputerDebug() {
    const startDate = new Date(2023, 4, 31, 12, 0, 0);

    try {
        await compoundV3Computer(0, startDate.getTime());
    } catch(e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
    
}

compoundV3ComputerDebug();