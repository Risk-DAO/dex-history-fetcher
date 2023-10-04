## 1. Data fetching

This is the first step of the process, which get the reserves data for all the pools we want from various DEXes

List of currently fetched dexes:
- Uniswap V2
- Uniswap V3
- Curve
- Sushiswap V2

The fetcher codes are here:
- [uniswapv2](../src/uniswap.v2/uniswap.v2.history.fetcher.js)
- [uniswapv3](../src/uniswap.v3/uniswap.v3.history.fetcher.js)
- [sushiswapv2](../src/sushiswap.v2/sushiswap.v2.history.fetcher.js)
- [curve](../src/curve/curve.history.fetcher.js)

### Configuration
Each fetcher has a configuration in the same directory named `*.config.js`. The configuration files contains the list of pairs to be fetched and many informations needed for the data fetch (like contract abi and addresses)

A node process is started for each of the dexes, it generates files in `./data/{platform}/`

Example: `./data/uniswapv2/WETH-USDT_uniswapv2.csv`

This file holds the historical reserve values of the WETH-USDT pool

|blocknumber                 |reserve_WETH|reserve_USDT|
|----------------------------|-------------------------------------------------------|-------------------------------------------------------|
|10111547                    |5973440903627713466                                    |1183858579                                             |
|10111691                    |6012816252902470409                                    |1176129104                                             |
|10112141                    |5912426008228491189                                    |1196159320                                             |
|10113789                    |5976897284904568732                                    |1183294945                                             |

This is raw data, which is not always the same for all the dexes (because we don't fetch the data the same way for univ3 and sushi for example)

Each process run in a loop and restart every 30 minutes. The fetchers only fetch the data since the last run. The first run can be very long (because of the amount of data that need to be fetched since the creation of the various pools) but after the first run, each subsequents runs are taking less than a minute or two.


## 2. Data unification

Because the raw data are not the same between the different venues, we need a step to generate data in a unified way across all venues.
This if the data unification step.

This step produces files in `./data/precomputed/{platform}`

Example: `./data/precomputed/uniswapv2/WETH-USDC-unified-data.csv`

The unified data format is the following:

|blocknumber                 |price              |slippagemap|
|----------------------------|-------------------|-----------|
|18276221                    |1644.472943959098  |   {"50":42.781635166029446,"100":85.88696577816154,"150":129.32009445555013,"200":173.0851969854375,"250":217.18652400950305,"300":261.62840275792405,"350":306.41523883284026,"400":351.5515180428265,"450":397.04180829009783,"500":442.89076151228073,"550":489.1031156806712,"600":535.6836968567659,"650":582.637421309315,"700":629.969297693824,"750":677.6844292967726,"800":725.7880163468362,"850":774.285358395482,"900":823.1818567694136,"950":872.4830170973728,"1000":922.1944519141543,"1050":972.3218833444189,"1100":1022.8711458693651,"1150":1073.8481891792435,"1200":1125.2590811148984,"1250":1177.1100107015918,"1300":1229.407291278636,"1350":1282.157363728329,"1400":1335.3667998080273,"1450":1389.0423055892425,"1500":1443.1907250077857,"1550":1497.8190435293582,"1600":1552.9343919348903,"1650":1608.54405023043,"1700":1664.6554516863325,"1750":1721.276187010917,"1800":1778.4140086638654,"1850":1836.0768353149615,"1900":1894.2727564539455,"1950":1953.0100371576336,"2000":2012.297123020653}       |
|18276279                    |1644.8779572585113 |   {"50":42.77639396267841,"100":85.87644371533679,"150":129.30425137451311,"200":173.06399221588435,"250":217.15991636036415,"300":261.5963505080108,"350":306.3776997212299,"400":351.50844925903584,"450":396.9931664640171,"500":442.8365027039108,"550":489.04319536953335,"600":535.618069931159,"650":582.5660420552376,"700":629.8921197836607,"750":677.601405777692,"800":725.6990996289387,"850":774.1905002396161,"900":823.0810082746902,"950":872.3761286884292,"1000":922.0814733280167,"1050":972.2027636170933,"1100":1022.7458333220748,"1150":1073.716631404317,"1200":1125.12122496128,"1250":1176.965802260016,"1300":1229.2566758663743,"1350":1282.0002858735788,"1400":1335.2032032338902,"1450":1388.8721331972374,"1500":1443.0139188609828,"1550":1497.6355448350405,"1600":1552.7441410267384,"1650":1608.3469865502411,"1700":1664.4515137652634,"1750":1721.0653124501732,"1800":1778.1961341148963,"1850":1835.8518964590912,"1900":1894.0406879814582,"1950":1952.7707727462475,"2000":2012.0505953134198}       |
|18276335                    |1644.9972174763896 |    {"50":42.77484690327765,"100":85.87333789113836,"150":129.29957493176698,"200":173.0577331498207,"250":217.15206251251948,"300":261.5868895634303,"350":306.36661920565166,"400":351.49573653597326,"450":396.978808731812,"500":442.820486992674,"550":489.02550853804496,"600":535.5986986636817,"650":582.5449728582571,"700":629.8693389825276,"750":677.5768995132312,"800":725.67285385391,"850":774.1625007151451,"900":823.0512405665795,"950":872.3445781633854,"1000":922.0481251497949,"1050":972.1676027425237,"1100":1022.7088444969995,"1150":1073.677799159428,"1200":1125.0805336078483,"1250":1176.923235885497,"1300":1229.2122183299325,"1350":1281.9539208014612,"1400":1335.1549140147,"1450":1388.8219029770662,"1500":1442.9617305384454,"1550":1497.581381056134,"1600":1552.6879841796035,"1650":1608.2888187597637,"1700":1664.3913168875224,"1750":1721.0030680667587,"1800":1778.1318235270555,"1850":1835.785500681719,"1900":1893.972187736912,"1950":1952.7001484580142,"2000":2011.9778270995703}       |

So for each blocks in the unified-data file, we store the price at that block (here it's the WETH-USDC-unified-data.csv file so the price means the number of USDC you can buy with 1 WETH) and the "slippageMap"

The slippage map is a json object that gives the precomputed slippage data for various amount of slippage, expressed in basis points. For example here the amount of WETH you can sell for USDC in uniswapv2 and for 500 bps slippage (5%) is 442.82 WETH

```
{
	"50": 42.77484690327765,
	"100": 85.87333789113836,
	"150": 129.29957493176698,
	"200": 173.0577331498207,
	"250": 217.15206251251948,
	"300": 261.5868895634303,
	"350": 306.36661920565166,
	"400": 351.49573653597326,
	"450": 396.978808731812,
	"500": 442.820486992674,
	"550": 489.02550853804496,
	"600": 535.5986986636817,
	"650": 582.5449728582571,
	"700": 629.8693389825276,
	"750": 677.5768995132312,
	"800": 725.67285385391,
	"850": 774.1625007151451,
	"900": 823.0512405665795,
	"950": 872.3445781633854,
	"1000": 922.0481251497949,
	"1050": 972.1676027425237,
	"1100": 1022.7088444969995,
	"1150": 1073.677799159428,
	"1200": 1125.0805336078483,
	"1250": 1176.923235885497,
	"1300": 1229.2122183299325,
	"1350": 1281.9539208014612,
	"1400": 1335.1549140147,
	"1450": 1388.8219029770662,
	"1500": 1442.9617305384454,
	"1550": 1497.581381056134,
	"1600": 1552.6879841796035,
	"1650": 1608.2888187597637,
	"1700": 1664.3913168875224,
	"1750": 1721.0030680667587,
	"1800": 1778.1318235270555,
	"1850": 1835.785500681719,
	"1900": 1893.972187736912,
	"1950": 1952.7001484580142,
	"2000": 2011.9778270995703
}
```

After this step, every data in ./data/precomputed is the same format

This step is automatically started at the end of each data fetch loop. So the precomputed data are updated every 30 minutes, like the raw data

## **This step can be VERY long for curve the first time you start it**

Because the way we compute the liquidity of the curve pools is by using a binary search algorithm, it takes many hours to generate all the unified-data files.

But as always, it's only very long for the first run