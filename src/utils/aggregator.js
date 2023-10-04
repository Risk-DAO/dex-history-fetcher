
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
 * @param {{[slippageBps: number]: number}} segment1Data 
 * @param {number} segment1Price 
 * @param {{[slippageBps: number]: number}} segment2Data 
 * @param {number} targetSlippageBps 
 */
function computeAggregatedVolumeFromPivot(segment1Data, segment1Price, segment2Data, targetSlippageBps) {
    let maxBaseAmount = 0;

    for(let bps = 50; bps < targetSlippageBps; bps += 50) {
        const segment1LiquidityForSlippage = segment1Data[bps];
        const segment2LiquidityForSlippage = segment2Data[targetSlippageBps - bps];
        const amountOfPivotObtainable = segment1LiquidityForSlippage * segment1Price * (10000 - bps) / 10000;
        const amountOfBaseFromSegment2 = segment2LiquidityForSlippage / segment1Price;

        // check that you can dump liquidity from segment1 into the liquidity for segment2
        if(amountOfPivotObtainable <= segment2LiquidityForSlippage) {

            // check if the maxBaseAmount is not higher, if not, consider this route the best route
            if(maxBaseAmount < segment1LiquidityForSlippage) {
                maxBaseAmount = segment1LiquidityForSlippage;
            }
        } else {
            if(maxBaseAmount < amountOfBaseFromSegment2) {
                maxBaseAmount = amountOfBaseFromSegment2;
            }
        }
    }
    
    return maxBaseAmount;
}

module.exports = { computeAggregatedVolumeFromPivot };