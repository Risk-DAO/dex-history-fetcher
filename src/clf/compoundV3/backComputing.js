const { compoundV3Computer } = require('./compoundV3Computer');



async function backComputing() {
    const startDate = new Date('04/01/2023');
    const endDate = new Date();
    let condition = startDate;
    while (condition <= endDate) {
        console.log(`fetching ${condition} data`);
        await compoundV3Computer(10, condition);
        condition.setDate(condition.getDate() + 1);
    }
}


backComputing();