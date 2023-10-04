# dex-history-fetcher

This repository contains all the code used to fetch the data from various DEXes and generate liquidity data for each pairs

To be able to do so without taking too much time, it's a multi step process

1. Data fetching
2. Data unification

Documentation available [here](./docs/README.md)

## Run a fetcher

1. `npm install`
1. Set the RPC_URL environment variable

`export RPC_URL=https://url/`
1. Start the uniswapv2 history fetcher

`node .\src\uniswap.v2\uniswap.v2.history.fetcher.js`

At the end, the process should display

```
UniswapV2HistoryFetcher: ending
UniswapV2HistoryFetcher: sleeping 28.69 minutes
```

And you should be able to see the ./data directory filled with data

```
./data/uniswapv2
./data/precomputed/uniswapv2
```

