const fs = require('fs');

async function main() {
    const fileContent = fs.readFileSync('data/uniswapv3/ETH-USDC-prices.csv', 'utf-8').split('\n');

    const biggestDiff = [];
    for(let i = 1; i < fileContent.length; i++) {
        const splt = fileContent[i].split(',');
        const block = Number(splt[0]);
        const liquiPrice = Number(splt[1]);
        const swapPrice = Number(splt[2]);
        if(liquiPrice == 0) {
            console.log(`liquidity price is 0 at block ${block}`);
            continue;
        }
        if(swapPrice == 0) {
            console.log(`swap price is 0 at block ${block}`);
            continue;
        }
        const diffPercent = (Math.abs(liquiPrice - swapPrice))/liquiPrice * 100;

        if(biggestDiff.length < 10) {
            biggestDiff.push({
                block: block,
                diff: diffPercent
            });
        } else {
            const indexOfLowerValue = biggestDiff.findIndex(_ => _.diff < diffPercent);
            if(indexOfLowerValue >= 0) {
                biggestDiff.splice(indexOfLowerValue, 1);
                
                biggestDiff.push({
                    block: block,
                    diff: diffPercent
                });
            }
        }

        biggestDiff.sort((a,b) => a.diff - b.diff);
    }

    biggestDiff.sort((a,b) => b.diff - a.diff);
    console.log(biggestDiff);
}


main();