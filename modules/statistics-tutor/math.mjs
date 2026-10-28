// Two-sided Student t confidence intervals. No runtime dependencies.
export function numberFrom(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (
    typeof value !== "string" ||
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  )
    return NaN;
  return Number(value.trim());
}
function logGamma(z) {
  const c = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5)
    return (
      Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  z -= 1;
  let x = 0.99999999999980993;
  c.forEach((v, i) => {
    x += v / (z + i + 1);
  });
  const t = z + 7.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
  );
}
function betaFraction(a, b, x) {
  const tiny = 1e-300;
  let c = 1,
    d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    let aa = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) return h;
  }
  throw new Error("Beta calculation did not converge");
}
function beta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log1p(-x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (factor * betaFraction(a, b, x)) / a
    : 1 - (factor * betaFraction(b, a, 1 - x)) / b;
}
export function tCDF(t, df) {
  if (!Number.isFinite(t) || !Number.isInteger(df) || df < 1)
    throw new RangeError("Invalid t or degrees of freedom");
  const tail = 0.5 * beta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}
export function tCritical(confidence, df) {
  if (
    !Number.isFinite(confidence) ||
    confidence <= 0 ||
    confidence >= 1 ||
    !Number.isInteger(df) ||
    df < 1
  )
    throw new RangeError("Invalid confidence or degrees of freedom");
  const target = (1 + confidence) / 2;
  let lo = 0,
    hi = 1;
  while (tCDF(hi, df) < target) {
    hi *= 2;
    if (hi > 1e15) throw new RangeError("Confidence too close to 1");
  }
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    if (tCDF(mid, df) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
export function interval({ n, mean, sd, confidence }) {
  if (
    !Number.isInteger(n) ||
    n < 2 ||
    ![mean, sd, confidence].every(Number.isFinite) ||
    sd < 0 ||
    confidence <= 0 ||
    confidence >= 1
  )
    throw new RangeError("Invalid interval inputs");
  const df = n - 1,
    t = tCritical(confidence, df),
    se = sd / Math.sqrt(n),
    margin = t * se;
  return {
    df,
    t,
    se,
    margin,
    lower: mean - margin,
    upper: mean + margin,
    width: 2 * margin,
  };
}
export function closeEnough(input, expected, decimals = 3, extraTolerance = 0) {
  const value = numberFrom(input);
  return (
    Number.isFinite(value) &&
    Math.abs(value - expected) <= 0.5 * 10 ** -decimals + extraTolerance + 1e-10
  );
}
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rng) {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}
export function simulate({
  n = 25,
  mu = 50,
  sigma = 10,
  confidence = 0.95,
  count = 100,
  seed = 101,
} = {}) {
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 10000 ||
    !Number.isFinite(mu) ||
    !Number.isFinite(sigma) ||
    sigma <= 0 ||
    !Number.isInteger(n) ||
    n < 2 ||
    n > 10000
  )
    throw new RangeError("Invalid simulation inputs");
  const t = tCritical(confidence, n - 1),
    rng = random(seed),
    rows = [];
  for (let j = 0; j < count; j++) {
    let mean = 0,
      m2 = 0;
    for (let i = 1; i <= n; i++) {
      const x = mu + sigma * normal(rng),
        delta = x - mean;
      mean += delta / i;
      m2 += delta * (x - mean);
    }
    const sd = Math.sqrt(m2 / (n - 1)),
      margin = (t * sd) / Math.sqrt(n);
    rows.push({
      mean,
      sd,
      lower: mean - margin,
      upper: mean + margin,
      covers: mean - margin <= mu && mean + margin >= mu,
    });
  }
  return rows;
}
