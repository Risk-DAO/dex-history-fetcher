

## Accessing the data

To access the data, the data interface has been designed so that it manages all the file access and data formating.

code here: [data.interface.js](../src/data.interface/data.interface.js)

The data interface exposes 5 functions:

- getVolatility(platform, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg)
- getAveragePrice(platform, fromSymbol, toSymbol, fromBlock, toBlock)
- getAverageLiquidity(platform, fromSymbol, toSymbol, fromBlock, toBlock, withJumps = true)
- getLiquidity(platform, fromSymbol, toSymbol, fromBlock, toBlock, withJumps = true, stepBlock = DEFAULT_STEP_BLOCK)
- getLiquidityAllPlatforms(fromSymbol, toSymbol, fromBlock, toBlock, withJumps = true, stepBlock = DEFAULT_STEP_BLOCK)

Reminder: a platform is a dex: uniswapv2, curve, etc...
### getVolatility(platform, fromSymbol, toSymbol, fromBlock, toBlock, daysToAvg)
For a specific platform and block interval, compute the parkinson volatility of a pair

### getAveragePrice(platform, fromSymbol, toSymbol, fromBlock, toBlock)
For a specific platform and block interval, compute the average price of the pair

### getAverageLiquidity(platform, fromSymbol, toSymbol, fromBlock, toBlock, withJumps = true)
For a specific platform and block interval, compute the average liquidity. 
'withJumps' parameter: please refer to the aggregation routes. 

### getLiquidity(platform, fromSymbol, toSymbol, fromBlock, toBlock, withJumps = true, stepBlock = DEFAULT_STEP_BLOCK)
For a specific platform and block interval, this function returns the liquidity history.
'withJumps' parameter: please refer to the aggregation routes. 
'stepBlock' parameter represents the interval between each history point. For instance, setting it to 5000 will return data points every 5000 blocks within the specified 'fromBlock' to 'toBlock' range. Default to 300

### getLiquidityAllPlatforms(fromSymbol, toSymbol, fromBlock, toBlock, withJumps = true, stepBlock = DEFAULT_STEP_BLOCK)
Calculate the total liquidity across all platforms by summing the liquidity from each platform, and compute the average price by taking the average of the prices across all platforms


### Aggregation routes

To try to add as much liquidity from a platform for a specific pair, we implemented an aggregator function using 3 pivot currencies:
USDC, WETH and WBTC

Each time we compute the liquidity for a pair BASE/QUOTE, we also try to add some of the liquidity of the routes
- BASE/USDC -> USDC/QUOTE
- BASE/WETH -> WETH/QUOTE
- BASE/WBTC -> WBTC/QUOTE

The aggregator code is here: [computeAggregatedVolumeFromPivot](../src/utils/aggregator.js)

To illustrate, consider computing the trading volume for a 5% slippage in the UNI/USDC pair using two separate segments: UNI/WETH and WETH/USDC. To do so, we will gives the slippageMap of UNI/WETH and the slippageMap of WETH/USDC to the aggregator function.

Here's a step-by-step breakdown:

1. Begin with the liquidity for a 0.5% slippage in the UNI/WETH segment. Check if the amount of WETH you can obtain at this slippage level is less than or equal to the trading volume available in the WETH/USDC segment at a 4.5% slippage level. If it is, save the UNI base amount for the 0.5% slippage scenario.
2. If the condition in step 1 is not met, take the maximum value that can be traded from the second segment (segment2) and convert it to UNI using the price from the first segment (segment1). Only save this value if it's the highest value obtained so far.
3. Repeat the process (1 and 2) for a 1% slippage in the UNI/WETH segment and compare it against a 4% slippage in the WETH/USDC segment.
4. Repeat (1 and 2) by incrementing the slippage of the segment1 by 0.5 and decrementing the slippage of segment2 by 0.5
5. Finally, this function returns the maximum amount of UNI that can be obtained using the route UNI/WETH -> WETH/USDC while accounting for a total slippage of 5%.

This slippage can then be added to the direct UNI/USDC liquidity we can have.
And we can then also add UNI/WBTC -> WBTC/USDC liquidity using the same aggregator function