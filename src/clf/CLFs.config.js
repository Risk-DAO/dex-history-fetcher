const { compoundV3Computer } = require('./compoundV3/compoundV3Computer');

const CLFsConfig = [
    {
        name: 'compoundv3',
        toLaunch: compoundV3Computer
    }
];


module.exports = {CLFsConfig};