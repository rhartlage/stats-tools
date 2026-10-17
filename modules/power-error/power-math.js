/* Pure calculations for the Power & Error Explorer. No browser or network dependencies.
 *
 * Mean model: exact normal sampling distribution when observations are independent
 * normal and the common population sigma is known. It is a CLT approximation for
 * other populations; it is NOT an unknown-sigma t test.
 *
 * Proportions model: untransformed, no-continuity-correction normal PLANNING
 * approximation for D = pHat2 - pHat1. The H0 variance uses the fixed planning
 * weighted pooled rate. The Ha variance uses each stipulated population rate.
 * A realized pooled-z test has a random estimated denominator; its exact rejection
 * region is not this fixed raw-difference boundary. This is not an exact binomial
 * test or the arcsine/Cohen-h method. Neither t nor chi-square models are implemented.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PowerMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_ALPHA = 0.0001;
  const MAX_ALPHA = 0.9999;
  const INV_SQRT_TWO_PI = 1 / Math.sqrt(2 * Math.PI);
  const DEFAULTS = Object.freeze({
    model: "mean", tail: "right", mu0: 100, mu1: 105, sigma: 15, n: 50,
    p1: 0.14, p2: 0.19, n1: 681, n2: 681, alpha: 0.05
  });

  function finite(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RangeError(name + " must be a finite number.");
    }
    return value;
  }

  function positiveInteger(value, name) {
    finite(value, name);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(name + " must be a positive whole number.");
    }
    return value;
  }

  function clampProbability(value) {
    return Math.max(0, Math.min(1, value));
  }

  function normalPDF(z) {
    if (typeof z !== "number" || Number.isNaN(z)) return NaN;
    return INV_SQRT_TWO_PI * Math.exp(-0.5 * z * z);
  }

  // Stable standard-normal upper tail for z >= 0. Below 3, integrate the
  // exponential's convergent positive series. Above 3, use the Laplace continued
  // fraction for the Mills ratio, preserving tiny probabilities without 1 - CDF.
  function upperTail(z) {
    if (z === Infinity) return 0;
    if (z >= 3) {
      let fraction = 0;
      for (let k = 200; k >= 1; k -= 1) fraction = k / (z + fraction);
      return normalPDF(z) / (z + fraction);
    }
    let term = z;
    let sum = z;
    for (let denominator = 3; denominator < 1000; denominator += 2) {
      term *= z * z / denominator;
      const previous = sum;
      sum += term;
      if (sum === previous) break;
    }
    return clampProbability(0.5 - normalPDF(z) * sum);
  }

  function normalCDF(z) {
    if (typeof z !== "number" || Number.isNaN(z)) return NaN;
    return z < 0 ? upperTail(-z) : 1 - upperTail(z);
  }

  // Bisection of the monotone tail avoids separate approximate inverse formulae.
  // 80 iterations exceed double-precision resolution over the full useful range.
  function normalInv(p) {
    finite(p, "Probability");
    if (p < 0 || p > 1) throw new RangeError("Probability must be between 0 and 1.");
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    if (p === 0.5) return 0;
    const target = p < 0.5 ? p : 1 - p;
    let low = 0;
    let high = 40;
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const midpoint = (low + high) / 2;
      if (upperTail(midpoint) > target) low = midpoint;
      else high = midpoint;
    }
    const value = (low + high) / 2;
    return p < 0.5 ? -value : value;
  }

  function distributions(input) {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new RangeError("State must be an object.");
    }
    const state = Object.assign({}, DEFAULTS, input);
    if (!["mean", "proportions"].includes(state.model)) throw new RangeError("Choose a supported model.");
    if (!["right", "left", "two"].includes(state.tail)) throw new RangeError("Choose a supported test direction.");
    finite(state.alpha, "Alpha");
    if (state.alpha < MIN_ALPHA || state.alpha > MAX_ALPHA) {
      throw new RangeError("Alpha must be between 0.0001 and 0.9999.");
    }
    const warnings = [];
    if (state.model === "mean") {
      const mean0 = finite(state.mu0, "Null mean");
      const mean1 = finite(state.mu1, "Alternative mean");
      const sigma = finite(state.sigma, "Population standard deviation");
      if (sigma <= 0) throw new RangeError("Population standard deviation must be greater than zero.");
      const se = sigma / Math.sqrt(positiveInteger(state.n, "Sample size"));
      if (!(se > 0) || !Number.isFinite((mean1 - mean0) / se)) {
        throw new RangeError("These values exceed the numerical range; use less extreme means or variability.");
      }
      return { state, mean0, mean1, se0: se, se1: se, pooled: null, warnings };
    }
    const p1 = finite(state.p1, "Group 1 proportion");
    const p2 = finite(state.p2, "Group 2 proportion");
    if (p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1) {
      throw new RangeError("Population proportions must be strictly between 0 and 1.");
    }
    const n1 = positiveInteger(state.n1, "Group 1 sample size");
    const n2 = positiveInteger(state.n2, "Group 2 sample size");
    const pooled = (n1 * p1 + n2 * p2) / (n1 + n2);
    const se0 = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
    const se1 = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
    if (!(se0 > 0) || !(se1 > 0)) {
      throw new RangeError("These proportions and sample sizes exceed the numerical range; use less extreme values.");
    }
    const expectedAlternative = [n1 * p1, n1 * (1 - p1), n2 * p2, n2 * (1 - p2)];
    const expectedNull = [n1 * pooled, n1 * (1 - pooled), n2 * pooled, n2 * (1 - pooled)];
    if (Math.min(...expectedAlternative, ...expectedNull) < 10) {
      warnings.push("At least one expected success or failure count is below 10. The normal approximation may be unreliable; use an appropriate exact or simulation method for study planning.");
    }
    return { state, mean0: 0, mean1: p2 - p1, se0, se1, pooled, warnings };
  }

  // Return finite/infinite acceptance-region endpoints: reject below lower and/or
  // above upper. For two-sided tests alpha is split equally between mirrored tails.
  // z is signed for a left-sided cutoff; for two-sided it is the upper z boundary.
  function derive(input = {}) {
    const d = distributions(input);
    const { state, mean0, mean1, se0, se1, pooled, warnings } = d;
    const z = state.tail === "left" ? normalInv(state.alpha)
      : normalInv(1 - state.alpha / (state.tail === "two" ? 2 : 1));
    const lower = state.tail === "right" ? -Infinity
      : mean0 + (state.tail === "two" ? -z : z) * se0;
    const upper = state.tail === "left" ? Infinity : mean0 + z * se0;
    if ((state.tail !== "right" && !Number.isFinite(lower)) ||
        (state.tail !== "left" && !Number.isFinite(upper))) {
      throw new RangeError("The decision cutoff exceeds the numerical range.");
    }
    const lo = (lower - mean1) / se1;
    const hi = (upper - mean1) / se1;
    const power = clampProbability(normalCDF(lo) + normalCDF(-hi));
    // Choose the subtraction that avoids cancellation when both limits are positive.
    const beta = clampProbability(lo > 0
      ? normalCDF(-lo) - normalCDF(-hi)
      : normalCDF(hi) - normalCDF(lo));
    return { mean0, mean1, se0, se1, lower, upper, alpha: state.alpha, beta, power, z, pooled, warnings };
  }

  // Dragging either two-sided bar changes the distance from H0 and mirrors the
  // other bar. This never silently changes the chosen direction or alternative.
  function alphaForCutoff(input, rawValue) {
    const d = distributions(input);
    finite(rawValue, "Decision cutoff");
    const z = (rawValue - d.mean0) / d.se0;
    const alpha = d.state.tail === "two" ? 2 * normalCDF(-Math.abs(z))
      : d.state.tail === "left" ? normalCDF(z) : normalCDF(-z);
    return Math.max(MIN_ALPHA, Math.min(MAX_ALPHA, alpha));
  }

  return Object.freeze({ normalCDF, normalPDF, normalInv, derive, alphaForCutoff });
});
