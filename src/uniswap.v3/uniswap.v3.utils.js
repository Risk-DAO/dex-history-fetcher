
const BigNumber = require('bignumber.js');
const Web3 = require('web3');

module.exports = { get_dy, get_dx };

function toWei(n) {
    return Web3.utils.toWei(n.toString());
}

function get_dy(tick, tickSpacing, sqrtPriceX96, liquidity, dx) {
    const base = new BigNumber(1.0001);

    let remainingQty = new BigNumber(dx);
    let dy = new BigNumber(0);
    BigNumber.config({ POW_PRECISION: 10 });
    const _96bits = new BigNumber(2).pow(new BigNumber(96));
    let currSqrtPrice = new BigNumber(sqrtPriceX96).div(_96bits); 
    let currTick = Number(tick);

    // when selling x, the price goes up
    while(remainingQty.gt(0)) {
        const nextTick = currTick - Number(tickSpacing);
        //console.log({base},{nextTick})
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        const L = new BigNumber(toWei(liquidity[currTick]));
        console.log({currTick});

        // dx = L/d(sqrt(p))
        const dP = currSqrtPrice.minus(nextSqrtPrice);
        const maxDx = (L.div(nextSqrtPrice)).minus(L.div(currSqrtPrice));
        console.log(L.toString(), maxDx.toString(), currSqrtPrice.toString());

        //console.log(currSqrtPrice.toString(), nextSqrtPrice.toString())

        let dSqrtP;
        if(remainingQty.lt(maxDx)) {
            // qty = L/nextP - L/p
            // L/nextP = L/p + qty
            // nextP = L/(L/p + qty)
            const nextP = L.div(L.div(currSqrtPrice).plus(remainingQty));
            dSqrtP = currSqrtPrice.minus(nextP);
            remainingQty = new BigNumber(0);
        }
        else {
            dSqrtP = currSqrtPrice.minus(nextSqrtPrice);
            remainingQty = remainingQty.minus(maxDx);
            console.log('maxDx', maxDx.toString());
        }

        // dy = L * d(sqrt(p))
        dy = dy.plus(L.times(dSqrtP));


        console.log('dy', dy.toString(), remainingQty.toString(), currTick);


        // move to next tick
        currSqrtPrice = nextSqrtPrice;
        currTick = nextTick;
    }

    return dy;
}

function get_dx(tick, tickSpacing, sqrtPriceX96, liquidity, dy) {
    const base = new BigNumber(1.0001);

    let remainingQty = new BigNumber(dy);
    let dx = new BigNumber(0);
    BigNumber.config({ POW_PRECISION: 10 });
    const _96bits = new BigNumber(2).pow(new BigNumber(96));
    let currSqrtPrice = new BigNumber(sqrtPriceX96).div(_96bits); 
    let currTick = Number(tick);

    // when selling y, the price goes down
    while(remainingQty.gt(0)) {
        const nextTick = currTick + Number(tickSpacing);
        //console.log({base},{nextTick})
        const nextSqrtPrice = (base.pow(nextTick)).sqrt();

        const L = new BigNumber(liquidity[currTick]).times(new BigNumber(1e18));
        // console.log({currTick});

        // dx = L/d(sqrt(p))
        const maxDy = L.times(nextSqrtPrice.minus(currSqrtPrice));
        // console.log(L.toString(), maxDy.toString(), currSqrtPrice.toString());

        //console.log(currSqrtPrice.toString(), nextSqrtPrice.toString())

        let nextP;
        if(remainingQty.lt(maxDy)) {
            // qty = L(nextP - P)
            // nextP = p + qty/L
            nextP = currSqrtPrice.plus(remainingQty.div(L));
            remainingQty = new BigNumber(0);
        }
        else {
            nextP = nextSqrtPrice;
            remainingQty = remainingQty.minus(maxDy);
            // console.log('maxDy', maxDy.toString());
        }

        // dx = L/pcurrent - L/pnext
        dx = dx.plus(L.div(currSqrtPrice).minus(L.div(nextP)));
        // console.log(nextP.toString(), currSqrtPrice.toString());


        // console.log('dx', dx.toString(), remainingQty.toString(), currTick);


        // move to next tick
        currSqrtPrice = nextSqrtPrice;
        currTick = nextTick;
    }

    return dx;
}