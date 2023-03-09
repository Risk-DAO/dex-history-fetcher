const { getUniV2DataforBlockRange } = require('../uniswap.v2/uniswap.v2.utils');


async function main() {
    const results = await getUniV2DataforBlockRange('data', 'eth', 'usdc', [16648878, 16648838]);
    console.log(results);
}


main();