
/**
 * Compute the aggregated volume from two segments
 * Example to compute the volume for slippage of UNI/USDC using the two "segments"
 * UNI/WETH and WETH/USDC
 * Example for a target of 5% slippage:
 *  Start by trying to get the volume for 0.5% slippage of UNI/WETH and check if the amount of WETH
 *  obtainable is <= the volume for WETH/USDC for 4.5% slippage. If it is save the UNI base amount for 0.5% slippage
 *  else take the value dumpable from the segment2 and transform to UNI (using segment1 price)
 *  only if it's the maximum value we ever got. Then try for 1% slippage UNI/WETH and check against 4% slippage WETH/USDC
 *  This function then returns the maximum of UNI that is available using the route UNI/WETH -> WETH/USDC and a total of 5% slippage
 * @param {{[slippageBps: number]: {base: number, quote: number}}} segment1Data for example, this is the liquidity data for UNI/WETH
 * @param {number} segment1Price 
 * @param {{[slippageBps: number]: {base: number, quote: number}}} segment2Data for example, this is the liquidity data for WETH/USDC
 * @param {number} targetSlippageBps 
 * @returns {{base: number, quote: number}} for example base is UNI and quote is USDC
 */
function computeAggregatedVolumeFromPivot(segment1Data, segment2Data, targetSlippageBps) {
    let maxBaseAmount = 0;
    let quoteAmount = 0;

    for(let bps = 50; bps < targetSlippageBps; bps += 50) {
        // for segment1, base is UNI, quote is WETH
        const segment1LiquidityForSlippage = segment1Data[bps];
        const segment1AvgPriceForSelectedSlippage = segment1LiquidityForSlippage.quote / segment1LiquidityForSlippage.base;

        // for segment2 base is WETH, quote is USDC
        const segment2LiquidityForSlippage = segment2Data[targetSlippageBps - bps];
        const segment2AvgPriceForSelectedSlippage = segment2LiquidityForSlippage.quote / segment2LiquidityForSlippage.base;

        const amountOfBaseFromSegment2 = segment2LiquidityForSlippage.base / segment1AvgPriceForSelectedSlippage;
        const amountOfQuoteFromSegment1 = segment1LiquidityForSlippage.quote * segment2AvgPriceForSelectedSlippage;
        
        // check that you can dump liquidity from segment1 into the liquidity for segment2
        if(segment1LiquidityForSlippage.quote <= segment2LiquidityForSlippage.base) {

            // check if the maxBaseAmount is not higher, if not, consider this route the best route
            if(maxBaseAmount < segment1LiquidityForSlippage) {
                maxBaseAmount = segment1LiquidityForSlippage.base;
                quoteAmount = amountOfQuoteFromSegment1;
            }
        } 
        // if you cannot dump liquidity from seg1 to seg2, take the amount from segment2 base
        // example for UNI/WETH with base = 200 and WETH/USDC = 150 then you cannot dump 200 from segment1 to segment2
        // so you take the UNI/WETH price, ex 0.0025053362839454513 and you take the base amount from segment2 (1500) and divide by price
        // 150 / 0.0025053362839454513 = 59872 UNI if 59872 UNI is more than the current base amount in memory, overwrite it
        else {
            if(maxBaseAmount < amountOfBaseFromSegment2) {
                maxBaseAmount = amountOfBaseFromSegment2;
                quoteAmount = segment2LiquidityForSlippage.quote;
            }
        }
    }
    
    return {base: maxBaseAmount, quote: quoteAmount};
}

module.exports = { computeAggregatedVolumeFromPivot };