export const roundStep = price => (price <= 5000 ? price : price < 10000 ? Math.ceil(price / 500) * 500 : Math.ceil(price / 1000) * 1000);

export const laterPrice = p => (p <= 5000 ? p : roundStep(5000 * Math.cbrt(p / 5000)));
