
/**
 * Compute parkinson liquidity from price dictionary
 * @param {{[blockNumber: number]: number}} priceAtBlock dictionary of prices, for each dictionary key (blocknumber), give the price
 * @param {string} fromSymbol 
 * @param {string} toSymbol 
 * @param {number} startBlock 
 * @param {number} endBlock 
 * @param {number} daysToAvg 
 * @returns {number}
 */
function computeParkinsonVolatility(priceAtBlock, fromSymbol, toSymbol, startBlock, endBlock, daysToAvg) {
    const blockNumbers = Object.keys(priceAtBlock);
    let lastPriceHigh = priceAtBlock[blockNumbers[0]];
    let lastPriceLow = priceAtBlock[blockNumbers[0]];
    const rangeValues = [];
    const avgBlockPerDay = Math.round((endBlock - startBlock) / daysToAvg);
    console.log(`avgBlockPerDay: ${avgBlockPerDay}`);
    for (let T = 0; T < daysToAvg; T++) {
        const blockStart = T * avgBlockPerDay + startBlock;
        const blockEnd = Math.min(blockStart + avgBlockPerDay, endBlock);
        const blocksInRange = blockNumbers.filter(_ => _ >= blockStart && _ < blockEnd);
        // console.log(`# prices in range [${blockStart} - ${blockEnd}]: ${blocksInRange.length}`);
        let highPrice = -1;
        let lowPrice = Number.MAX_SAFE_INTEGER;
        if (blocksInRange.length == 0) {
            highPrice = lastPriceHigh;
            lowPrice = lastPriceLow;
        }
        else {
            for (const block of blocksInRange) {
                const price = priceAtBlock[block];
                if (highPrice < price) {
                    highPrice = price;
                    lastPriceHigh = price;
                }
                if (lowPrice > price) {
                    lowPrice = price;
                    lastPriceLow = price;
                }
            }
        }

        if (highPrice < 0) {
            console.log(`Could not find prices for range [${blockStart} - ${blockEnd}]. Will use last value`);
            if (rangeValues.length == 0) {
                throw new Error(`Could not find even the first value for ${fromSymbol}/${toSymbol}`);
            } else {
                const lastValue = rangeValues.at(-1);
                highPrice = lastValue.high;
                lowPrice = lastValue.low;
            }
        }

        // console.log(`For range [${blockStart} - ${blockEnd}]: low: ${lowPrice} <> high: ${highPrice}. Data #: ${blocksInRange.length}`);
        rangeValues.push({ low: lowPrice, high: highPrice });

    }

    // console.log(rangeValues);
    let sumOfLn = 0;

    let daysCountWithValue = daysToAvg;
    for (let T = 0; T < daysToAvg; T++) {
        const valuesForRange = rangeValues[T];
        if(valuesForRange.low == 0) {
            // empty range, consider 1 less days to avg
            daysCountWithValue--;
            continue;
        }
        const htltRatio = valuesForRange.high / valuesForRange.low;
        const htltRatioSquare = htltRatio * htltRatio;
        const lnHtltRatioSquare = Math.log(htltRatioSquare);
        sumOfLn += lnHtltRatioSquare;
    }

    const prefix = 1 / ((4 * daysCountWithValue) * Math.log(2));

    const insideSqrt = prefix * sumOfLn;

    const volatilityParkinson = Math.sqrt(insideSqrt);
    console.log(`parkinson volatility for ${fromSymbol}/${toSymbol} for the last ${daysToAvg} days (days with values: ${daysCountWithValue}): ${volatilityParkinson}`);
    return volatilityParkinson;
}

module.exports = {computeParkinsonVolatility};