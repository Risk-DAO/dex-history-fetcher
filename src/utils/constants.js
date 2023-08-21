/**
 * Where all the files are saved
 */
const DATA_DIR = process.cwd() + '/data';

/**
 * List of platforms (dexes) that are available for data querying
 */
const PLATFORMS = ['uniswapv2', 'curve', 'uniswapv3'];

/**
 * Base slippages we are searching for the risk oracle frontend
 * Value in percent
 */
const TARGET_SLIPPAGES = [1, 5, 10, 15, 20];

/**
 * The spans of days we want to export to the risk oracle frontend
 */
const SPANS = [1, 7, 30, 180, 365];

module.exports = { DATA_DIR, PLATFORMS, TARGET_SLIPPAGES, SPANS};