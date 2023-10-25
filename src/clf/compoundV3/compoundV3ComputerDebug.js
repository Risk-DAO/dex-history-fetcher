const { compoundV3Computer } = require('./compoundV3Computer');

async function compoundV3ComputerDebug() {
    const startDates = [];
    startDates.push(new Date(2023, 5, 14, 12, 43, 15));
    startDates.push(new Date(2023, 5, 15, 12, 43, 15));
    // const startDate = new Date(2023, 7, 22, 12, 43, 15);
    // const startDate = new Date(2023, 7, 23, 12, 43, 15);

    try {

        for(const startDate of startDates) {
            await compoundV3Computer(0, startDate.getTime());
        }
    } catch(e) {
        console.error(e);
        process.exitCode = 1;
    } finally {
        process.exit();
    }
    
}

compoundV3ComputerDebug();