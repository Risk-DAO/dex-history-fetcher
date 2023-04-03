/* eslint-disable */

const uniswapFactoryV3Abi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":true,"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"FeeAmountEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"oldOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":true,"internalType":"uint24","name":"fee","type":"uint24"},{"indexed":false,"internalType":"int24","name":"tickSpacing","type":"int24"},{"indexed":false,"internalType":"address","name":"pool","type":"address"}],"name":"PoolCreated","type":"event"},{"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"}],"name":"createPool","outputs":[{"internalType":"address","name":"pool","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"name":"enableFeeAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"feeAmountTickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint24","name":"","type":"uint24"}],"name":"getPool","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"parameters","outputs":[{"internalType":"address","name":"factory","type":"address"},{"internalType":"address","name":"token0","type":"address"},{"internalType":"address","name":"token1","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"int24","name":"tickSpacing","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}]

const uniswapV3PairAbi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"Collect","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint128","name":"amount0","type":"uint128"},{"indexed":false,"internalType":"uint128","name":"amount1","type":"uint128"}],"name":"CollectProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"paid1","type":"uint256"}],"name":"Flash","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextOld","type":"uint16"},{"indexed":false,"internalType":"uint16","name":"observationCardinalityNextNew","type":"uint16"}],"name":"IncreaseObservationCardinalityNext","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Initialize","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"int24","name":"tickLower","type":"int24"},{"indexed":true,"internalType":"int24","name":"tickUpper","type":"int24"},{"indexed":false,"internalType":"uint128","name":"amount","type":"uint128"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"feeProtocol0Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1Old","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol0New","type":"uint8"},{"indexed":false,"internalType":"uint8","name":"feeProtocol1New","type":"uint8"}],"name":"SetFeeProtocol","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"int256","name":"amount0","type":"int256"},{"indexed":false,"internalType":"int256","name":"amount1","type":"int256"},{"indexed":false,"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"indexed":false,"internalType":"uint128","name":"liquidity","type":"uint128"},{"indexed":false,"internalType":"int24","name":"tick","type":"int24"}],"name":"Swap","type":"event"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collect","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint128","name":"amount0Requested","type":"uint128"},{"internalType":"uint128","name":"amount1Requested","type":"uint128"}],"name":"collectProtocol","outputs":[{"internalType":"uint128","name":"amount0","type":"uint128"},{"internalType":"uint128","name":"amount1","type":"uint128"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fee","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal0X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"feeGrowthGlobal1X128","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"flash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"}],"name":"increaseObservationCardinalityNext","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"liquidity","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"maxLiquidityPerTick","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"},{"internalType":"uint128","name":"amount","type":"uint128"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"mint","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"observations","outputs":[{"internalType":"uint32","name":"blockTimestamp","type":"uint32"},{"internalType":"int56","name":"tickCumulative","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityCumulativeX128","type":"uint160"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint32[]","name":"secondsAgos","type":"uint32[]"}],"name":"observe","outputs":[{"internalType":"int56[]","name":"tickCumulatives","type":"int56[]"},{"internalType":"uint160[]","name":"secondsPerLiquidityCumulativeX128s","type":"uint160[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"positions","outputs":[{"internalType":"uint128","name":"liquidity","type":"uint128"},{"internalType":"uint256","name":"feeGrowthInside0LastX128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthInside1LastX128","type":"uint256"},{"internalType":"uint128","name":"tokensOwed0","type":"uint128"},{"internalType":"uint128","name":"tokensOwed1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolFees","outputs":[{"internalType":"uint128","name":"token0","type":"uint128"},{"internalType":"uint128","name":"token1","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint8","name":"feeProtocol0","type":"uint8"},{"internalType":"uint8","name":"feeProtocol1","type":"uint8"}],"name":"setFeeProtocol","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"slot0","outputs":[{"internalType":"uint160","name":"sqrtPriceX96","type":"uint160"},{"internalType":"int24","name":"tick","type":"int24"},{"internalType":"uint16","name":"observationIndex","type":"uint16"},{"internalType":"uint16","name":"observationCardinality","type":"uint16"},{"internalType":"uint16","name":"observationCardinalityNext","type":"uint16"},{"internalType":"uint8","name":"feeProtocol","type":"uint8"},{"internalType":"bool","name":"unlocked","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"tickLower","type":"int24"},{"internalType":"int24","name":"tickUpper","type":"int24"}],"name":"snapshotCumulativesInside","outputs":[{"internalType":"int56","name":"tickCumulativeInside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityInsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsInside","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"bool","name":"zeroForOne","type":"bool"},{"internalType":"int256","name":"amountSpecified","type":"int256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[{"internalType":"int256","name":"amount0","type":"int256"},{"internalType":"int256","name":"amount1","type":"int256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"int16","name":"","type":"int16"}],"name":"tickBitmap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tickSpacing","outputs":[{"internalType":"int24","name":"","type":"int24"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"int24","name":"","type":"int24"}],"name":"ticks","outputs":[{"internalType":"uint128","name":"liquidityGross","type":"uint128"},{"internalType":"int128","name":"liquidityNet","type":"int128"},{"internalType":"uint256","name":"feeGrowthOutside0X128","type":"uint256"},{"internalType":"uint256","name":"feeGrowthOutside1X128","type":"uint256"},{"internalType":"int56","name":"tickCumulativeOutside","type":"int56"},{"internalType":"uint160","name":"secondsPerLiquidityOutsideX128","type":"uint160"},{"internalType":"uint32","name":"secondsOutside","type":"uint32"},{"internalType":"bool","name":"initialized","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}]

const uniswapFactoryV3Address = "0x1F98431c8aD98523631AE4a59f267346ea31F984"

// conf compound assets & risk oracle 
const pairsToFetch = [
  {
    "token0": "BAT",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "BAT",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "BAT",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "BAT",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "BAT",
    "token1": "WBTC",
    "fees": 3000
  },
  {
    "token0": "BAT",
    "token1": "DAI",
    "fees": 3000
  },
  {
    "token0": "DAI",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "DAI",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "DAI",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "DAI",
    "token1": "WETH",
    "fees": 100
  },
  {
    "token0": "DAI",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "DAI",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "DAI",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "DAI",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "WBTC",
    "token1": "DAI",
    "fees": 10000
  },
  {
    "token0": "WBTC",
    "token1": "DAI",
    "fees": 3000
  },
  {
    "token0": "WBTC",
    "token1": "DAI",
    "fees": 500
  },
  {
    "token0": "WBTC",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "WBTC",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "WBTC",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "WBTC",
    "token1": "WETH",
    "fees": 100
  },
  {
    "token0": "WBTC",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "WBTC",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "WBTC",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "WBTC",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "USDC",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "USDC",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "USDC",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "USDC",
    "token1": "WETH",
    "fees": 100
  },
  {
    "token0": "UNI",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "UNI",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "UNI",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "UNI",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "UNI",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "UNI",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "UNI",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "UNI",
    "token1": "WBTC",
    "fees": 10000
  },
  {
    "token0": "UNI",
    "token1": "WBTC",
    "fees": 3000
  },
  {
    "token0": "UNI",
    "token1": "DAI",
    "fees": 10000
  },
  {
    "token0": "UNI",
    "token1": "DAI",
    "fees": 3000
  },
  {
    "token0": "UNI",
    "token1": "DAI",
    "fees": 500
  },
  {
    "token0": "COMP",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "COMP",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "USDC",
    "token1": "COMP",
    "fees": 10000
  },
  {
    "token0": "USDC",
    "token1": "COMP",
    "fees": 3000
  },
  {
    "token0": "WBTC",
    "token1": "COMP",
    "fees": 10000
  },
  {
    "token0": "WBTC",
    "token1": "COMP",
    "fees": 3000
  },
  {
    "token0": "DAI",
    "token1": "COMP",
    "fees": 3000
  },
  {
    "token0": "TUSD",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "TUSD",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "TUSD",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "TUSD",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "TUSD",
    "token1": "DAI",
    "fees": 500
  },
  {
    "token0": "LINK",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "LINK",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "LINK",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "LINK",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "LINK",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "LINK",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "WBTC",
    "token1": "LINK",
    "fees": 3000
  },
  {
    "token0": "LINK",
    "token1": "DAI",
    "fees": 3000
  },
  {
    "token0": "LINK",
    "token1": "DAI",
    "fees": 500
  },
  {
    "token0": "MKR",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "MKR",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "MKR",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "MKR",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "MKR",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "MKR",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "DAI",
    "token1": "MKR",
    "fees": 3000
  },
  {
    "token0": "SUSHI",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "SUSHI",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "SUSHI",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "AAVE",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "AAVE",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "AAVE",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "AAVE",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "WBTC",
    "token1": "AAVE",
    "fees": 3000
  },
  {
    "token0": "DAI",
    "token1": "AAVE",
    "fees": 100
  },
  {
    "token0": "YFI",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "YFI",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "YFI",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "YFI",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "YFI",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "YFI",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "YFI",
    "token1": "WBTC",
    "fees": 3000
  },
  {
    "token0": "USDP",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "USDP",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "USDP",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "USDP",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "USDP",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "USDP",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "WBTC",
    "token1": "USDP",
    "fees": 3000
  },
  {
    "token0": "DAI",
    "token1": "USDP",
    "fees": 500
  },
  {
    "token0": "DAI",
    "token1": "USDP",
    "fees": 100
  },
  {
    "token0": "FEI",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "FEI",
    "token1": "WETH",
    "fees": 500
  },
  {
    "token0": "FEI",
    "token1": "USDC",
    "fees": 10000
  },
  {
    "token0": "FEI",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "FEI",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "FEI",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "DAI",
    "token1": "FEI",
    "fees": 3000
  },
  {
    "token0": "DAI",
    "token1": "FEI",
    "fees": 500
  },
  {
    "token0": "DAI",
    "token1": "FEI",
    "fees": 100
  },
  {
    "token0": "BUSD",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "BUSD",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "BUSD",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "BUSD",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "BUSD",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "WBTC",
    "token1": "BUSD",
    "fees": 3000
  },
  {
    "token0": "BUSD",
    "token1": "DAI",
    "fees": 10000
  },
  {
    "token0": "BUSD",
    "token1": "DAI",
    "fees": 3000
  },
  {
    "token0": "BUSD",
    "token1": "DAI",
    "fees": 500
  },
  {
    "token0": "BUSD",
    "token1": "DAI",
    "fees": 100
  },
  {
    "token0": "MANA",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "MANA",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "MANA",
    "token1": "USDC",
    "fees": 3000
  },
  {
    "token0": "MANA",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "SNX",
    "token1": "WETH",
    "fees": 10000
  },
  {
    "token0": "SNX",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "USDC",
    "token1": "SNX",
    "fees": 10000
  },
  {
    "token0": "USDC",
    "token1": "SNX",
    "fees": 3000
  },
  {
    "token0": "USDC",
    "token1": "SNX",
    "fees": 500
  },
  {
    "token0": "WBTC",
    "token1": "SNX",
    "fees": 10000
  },
  {
    "token0": "DAI",
    "token1": "SNX",
    "fees": 10000
  },
  {
    "token0": "DAI",
    "token1": "SNX",
    "fees": 3000
  },
  {
    "token0": "sUSD",
    "token1": "WETH",
    "fees": 3000
  },
  {
    "token0": "sUSD",
    "token1": "USDC",
    "fees": 500
  },
  {
    "token0": "sUSD",
    "token1": "USDC",
    "fees": 100
  },
  {
    "token0": "sUSD",
    "token1": "DAI",
    "fees": 3000
  },
  {
    "token0": "sUSD",
    "token1": "DAI",
    "fees": 500
  }
]

// conf for compound assets 
// const pairsToFetch = [
//     {
//       "token0": "BAT",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "BAT",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "BAT",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "BAT",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "BAT",
//       "token1": "DAI",
//       "fees": 3000
//     },
//     {
//       "token0": "BAT",
//       "token1": "WBTC",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 100
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "DAI",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "DAI",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "DAI",
//       "fees": 500
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 100
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "WETH",
//       "token1": "USDT",
//       "fees": 10000
//     },
//     {
//       "token0": "WETH",
//       "token1": "USDT",
//       "fees": 3000
//     },
//     {
//       "token0": "WETH",
//       "token1": "USDT",
//       "fees": 500
//     },
//     {
//       "token0": "WETH",
//       "token1": "USDT",
//       "fees": 100
//     },
//     {
//       "token0": "USDC",
//       "token1": "USDT",
//       "fees": 10000
//     },
//     {
//       "token0": "USDC",
//       "token1": "USDT",
//       "fees": 3000
//     },
//     {
//       "token0": "USDC",
//       "token1": "USDT",
//       "fees": 500
//     },
//     {
//       "token0": "USDC",
//       "token1": "USDT",
//       "fees": 100
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDT",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDT",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDT",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDT",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDT",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDT",
//       "fees": 500
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "DAI",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "DAI",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "DAI",
//       "fees": 500
//     },
//     {
//       "token0": "WETH",
//       "token1": "ZRX",
//       "fees": 10000
//     },
//     {
//       "token0": "WETH",
//       "token1": "ZRX",
//       "fees": 3000
//     },
//     {
//       "token0": "USDC",
//       "token1": "ZRX",
//       "fees": 10000
//     },
//     {
//       "token0": "UNI",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "UNI",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "UNI",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "UNI",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "UNI",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "UNI",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "UNI",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "UNI",
//       "token1": "DAI",
//       "fees": 10000
//     },
//     {
//       "token0": "UNI",
//       "token1": "DAI",
//       "fees": 3000
//     },
//     {
//       "token0": "UNI",
//       "token1": "DAI",
//       "fees": 500
//     },
//     {
//       "token0": "UNI",
//       "token1": "WBTC",
//       "fees": 10000
//     },
//     {
//       "token0": "UNI",
//       "token1": "WBTC",
//       "fees": 3000
//     },
//     {
//       "token0": "COMP",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "COMP",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "USDC",
//       "token1": "COMP",
//       "fees": 10000
//     },
//     {
//       "token0": "USDC",
//       "token1": "COMP",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "COMP",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "COMP",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "COMP",
//       "fees": 3000
//     },
//     {
//       "token0": "TUSD",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "TUSD",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "TUSD",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "TUSD",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "TUSD",
//       "token1": "DAI",
//       "fees": 500
//     },
//     {
//       "token0": "LINK",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "LINK",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "LINK",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "LINK",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "LINK",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "LINK",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "LINK",
//       "token1": "DAI",
//       "fees": 3000
//     },
//     {
//       "token0": "LINK",
//       "token1": "DAI",
//       "fees": 500
//     },
//     {
//       "token0": "WBTC",
//       "token1": "LINK",
//       "fees": 3000
//     },
//     {
//       "token0": "MKR",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "MKR",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "MKR",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "MKR",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "MKR",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "MKR",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "MKR",
//       "fees": 3000
//     },
//     {
//       "token0": "SUSHI",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "SUSHI",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "SUSHI",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "AAVE",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "AAVE",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "AAVE",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "AAVE",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "AAVE",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "AAVE",
//       "fees": 3000
//     },
//     {
//       "token0": "YFI",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "YFI",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "YFI",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "YFI",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "YFI",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "YFI",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "YFI",
//       "token1": "WBTC",
//       "fees": 3000
//     },
//     {
//       "token0": "USDP",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "USDP",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "USDP",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "USDP",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "USDP",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "USDP",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDP",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "USDP",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "USDP",
//       "fees": 3000
//     },
//     {
//       "token0": "FEI",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "FEI",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "FEI",
//       "token1": "USDC",
//       "fees": 10000
//     },
//     {
//       "token0": "FEI",
//       "token1": "USDC",
//       "fees": 3000
//     },
//     {
//       "token0": "FEI",
//       "token1": "USDC",
//       "fees": 500
//     },
//     {
//       "token0": "FEI",
//       "token1": "USDC",
//       "fees": 100
//     },
//     {
//       "token0": "DAI",
//       "token1": "FEI",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "FEI",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "FEI",
//       "fees": 100
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "USDC",
//       "token1": "WETH",
//       "fees": 100
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "DAI",
//       "token1": "WETH",
//       "fees": 100
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 10000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 3000
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 500
//     },
//     {
//       "token0": "WBTC",
//       "token1": "WETH",
//       "fees": 100
//     }
// ]


// conf risk oracle
// const pairsToFetch = [
//     {
//         "token0": "USDC",
//         "token1": "WETH",
//         "fees": 500
//     },
//     {
//         "token0": "WBTC",
//         "token1": "USDC",
//         "fees": 3000
//     },
//     {
//         "token0": "WBTC",
//         "token1": "WETH",
//         "fees": 500
//     },
//     {
//         "token0": "BUSD",
//         "token1": "USDC",
//         "fees": 100
//     },
//     {
//         "token0": "DAI",
//         "token1": "USDC",
//         "fees": 100
//     },
//     {
//         "token0": "DAI",
//         "token1": "WETH",
//         "fees": 500
//     },
//     {
//         "token0": "LINK",
//         "token1": "WETH",
//         "fees": 3000
//     },
//     {
//         "token0": "LINK",
//         "token1": "USDC",
//         "fees": 3000
//     },
//     {
//         "token0": "LINK",
//         "token1": "USDC",
//         "fees": 3000
//     },
//     {
//         "token0": "MANA",
//         "token1": "WETH",
//         "fees": 3000
//     },
//     {
//         "token0": "MANA",
//         "token1": "USDC",
//         "fees": 3000
//     },
//     {
//         "token0": "MKR",
//         "token1": "WETH",
//         "fees": 3000
//     },
//     {
//         "token0": "MKR",
//         "token1": "USDC",
//         "fees": 10000
//     },
//     {
//         "token0": "SNX",
//         "token1": "WETH",
//         "fees": 3000
//     },
//     {
//         "token0": "USDC",
//         "token1": "SNX",
//         "fees": 10000
//     },
//     {
//         "token0": "sUSD",
//         "token1": "USDC",
//         "fees": 100
//     },
//     {
//         "token0": "UNI",
//         "token1": "WETH",
//         "fees": 3000
//     },
//     {
//         "token0": "UNI",
//         "token1": "USDC",
//         "fees": 100
//     },
//     {
//         "token0": "UNI",
//         "token1": "WBTC",
//         "fees": 3000
//     },
//     {
//         "token0": "USDC",
//         "token1": "USDT",
//         "fees": 100
//     },
//     {
//         "token0": "WETH",
//         "token1": "USDT",
//         "fees": 500
//     },
//     {
//         "token0": "WBTC",
//         "token1": "USDT",
//         "fees": 3000
//     },

// ]

module.exports = {
    uniswapV3PairAbi, uniswapFactoryV3Abi, uniswapFactoryV3Address, pairsToFetch
}