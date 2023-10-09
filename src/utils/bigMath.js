const bigMath = {
    abs(x) {
        return x < 0n ? -x : x;
    },
    sign(x) {
        if (x === 0n) return 0n;
        return x < 0n ? -1n : 1n;
    },
    pow(base, exponent) {
        return base ** exponent;
    },
    min(value, ...values) {
        for (const v of values)
            if (v < value) value = v;
        return value;
    },
    max(value, ...values) {
        for (const v of values)
            if (v > value) value = v;
        return value;
    },
    rootNth(val, k=2n, limit=-1) {
        k = BigInt(k);
        let o = 0n; // old approx value
        let x = val;
        
        while(x**k!==k && x!==o && --limit) {
            o=x;
            x = ((k-1n)*x + val/x**(k-1n))/k;
            if(limit<0 && (x-o)**2n == 1n) break;
        }
        
        if ((val-(x-1n)**k)**2n < (val-x**k)**2n) x=x-1n;
        if ((val-(x+1n)**k)**2n < (val-x**k)**2n) x=x+1n;
        return x;
    }
};

module.exports = { bigMath };