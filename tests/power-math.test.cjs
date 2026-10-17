"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const M = require("../modules/power-error/power-math.js");

function near(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
}

const mean = { model: "mean", tail: "right", mu0: 100, mu1: 105, sigma: 15, n: 50, alpha: 0.05 };
const proportions = { model: "proportions", tail: "right", p1: 0.14, p2: 0.19, n1: 681, n2: 681, alpha: 0.05 };

test("standard-normal density, CDF, and tails match reference values", () => {
  near(M.normalPDF(0), 0.3989422804014327);
  near(M.normalPDF(1), 0.24197072451914337);
  for (const [z, expected] of [[0, 0.5], [1, 0.8413447460685429], [1.96, 0.9750021048517795],
    [-3, 0.0013498980316300946], [-5, 2.866515718791933e-7], [-8, 6.220960574271784e-16]]) {
    near(M.normalCDF(z), expected, Math.max(1e-30, expected * 3e-14));
    near(M.normalCDF(-z) + M.normalCDF(z), 1);
  }
  near(M.normalCDF(3 - 1e-10), 0.9986501019679267, 1e-14);
  assert.equal(M.normalCDF(-Infinity), 0);
  assert.equal(M.normalCDF(Infinity), 1);
  assert.equal(M.normalPDF(Infinity), 0);
  assert.ok(Number.isNaN(M.normalCDF(NaN)));
});

test("normal inverse round trips central and extreme probabilities", () => {
  near(M.normalInv(0.975), 1.959963984540054, 2e-14);
  near(M.normalInv(0.95), 1.6448536269514722, 2e-14);
  near(M.normalInv(0.5), 0);
  for (const p of [1e-20, 1e-8, 0.0001, 0.01, 0.2, 0.5, 0.95, 0.9999]) {
    near(M.normalCDF(M.normalInv(p)), p, Math.max(1e-30, p * 3e-14));
  }
  assert.equal(M.normalInv(0), -Infinity);
  assert.equal(M.normalInv(1), Infinity);
  for (const p of [-0.1, 1.1, NaN, Infinity, "0.5"]) assert.throws(() => M.normalInv(p), RangeError);
});

test("known-sigma mean has exact standard error and raw cutoff", () => {
  const r = M.derive(mean);
  near(r.mean0, 100);
  near(r.mean1, 105);
  near(r.se0, 15 / Math.sqrt(50));
  near(r.se1, r.se0);
  near(r.upper, 100 + 1.6448536269514722 * 15 / Math.sqrt(50));
  assert.equal(r.lower, -Infinity);
  near(r.power, M.normalCDF((105 - r.upper) / r.se1));
  near(r.beta + r.power, 1);
  assert.ok(Math.abs(r.alpha + r.beta - 1) > 0.1);
});

test("reference two-proportion planning benchmark reproduces 681 per group", () => {
  const r = M.derive(proportions);
  near(r.pooled, 0.165);
  near(r.mean1, 0.05);
  near(r.se0, 0.02011531, 5e-9);
  near(r.se1, 0.02006963, 5e-9);
  near(r.upper, 0.03308673, 5e-9);
  near(r.z, 1.6448536269514722, 2e-14);
  near(r.power, 0.80031008, 5e-9);
  assert.ok(M.derive({ ...proportions, n1: 680, n2: 680 }).power < 0.8);
  assert.ok(r.power > 0.8);
  assert.deepEqual(r.warnings, []);
});

test("independent mean fixtures verify size, alpha, direction, and a dragged cutoff", () => {
  const base = { ...mean, mu0: 0, mu1: 1, sigma: 2, n: 25 };
  const fixtures = [
    [{}, { se0: 0.4, upper: 0.6579414508, beta: 0.1962350600, power: 0.8037649400 }],
    [{ n: 100 }, { se0: 0.2, power: 0.9996033850 }],
    [{ alpha: 0.01 }, { upper: 0.9305391496, power: 0.5689305681 }],
    [{ alpha: 0.10 }, { power: 0.8884731955 }],
    [{ tail: "two" }, { lower: -0.7839855938, upper: 0.7839855938, power: 0.7054180011 }]
  ];
  for (const [changes, expected] of fixtures) {
    const result = M.derive({ ...base, ...changes });
    for (const [key, value] of Object.entries(expected)) near(result[key], value, 1e-6);
    near(result.beta + result.power, 1);
  }
  const alpha = M.alphaForCutoff(base, 1);
  const dragged = M.derive({ ...base, alpha });
  near(alpha, 0.0062096653, 1e-6);
  near(dragged.upper, 1, 1e-6);
  near(dragged.beta, 0.5, 1e-6);
  near(dragged.power, 0.5, 1e-6);
});

test("independent proportion fixtures verify sample-size and two-sided power", () => {
  for (const [n, expectedPower] of [[680, 0.799797880921], [340, 0.544486327143],
    [1362, 0.969580972092], [2724, 0.999572052712]]) {
    const result = M.derive({ ...proportions, n1: n, n2: n });
    near(result.power, expectedPower, 1e-6);
    near(result.alpha, 0.05);
    near(result.beta + result.power, 1);
  }
  const two = M.derive({ ...proportions, tail: "two" });
  near(two.lower, -0.0394252760379, 1e-6);
  near(two.upper, 0.0394252760379, 1e-6);
  near(two.power, 0.700873292093, 1e-6);
});

test("two-sided acceptance bounds mirror H0 and split alpha equally", () => {
  for (const state of [mean, proportions]) {
    const r = M.derive({ ...state, tail: "two" });
    near(r.mean0 - r.lower, r.upper - r.mean0);
    near(M.normalCDF((r.lower - r.mean0) / r.se0), state.alpha / 2);
    near(M.normalCDF((r.mean0 - r.upper) / r.se0), state.alpha / 2);
    near(r.power + r.beta, 1);
    near(M.alphaForCutoff({ ...state, tail: "two" }, r.lower), state.alpha);
    near(M.alphaForCutoff({ ...state, tail: "two" }, r.upper), state.alpha);
  }
});

test("left/right mirror, and a wrong-direction effect is not made absolute", () => {
  const right = M.derive({ ...mean, mu0: 0, mu1: 1, sigma: 2, n: 25 });
  const left = M.derive({ ...mean, mu0: 0, mu1: -1, sigma: 2, n: 25, tail: "left" });
  near(right.power, left.power);
  near(right.upper, -left.lower);
  near(right.z, -left.z);
  const wrong = M.derive({ ...mean, mu0: 0, mu1: -1, sigma: 2, n: 25 });
  near(wrong.power, 0.0000170015, 5e-11);
  assert.ok(wrong.power < wrong.alpha);
  near(M.alphaForCutoff({ ...mean, tail: "right" }, 99), M.normalCDF(1 / (15 / Math.sqrt(50))));
  assert.ok(M.derive({ ...mean, alpha: 0.8 }).upper < mean.mu0);
  assert.ok(M.derive({ ...mean, alpha: 0.8, tail: "left" }).lower > mean.mu0);
});

test("zero-effect rejection probability equals alpha, with beta + power = 1", () => {
  for (const tail of ["right", "left", "two"]) {
    for (const state of [{ ...mean, mu1: mean.mu0 }, { ...proportions, p2: proportions.p1 }]) {
      const r = M.derive({ ...state, tail });
      near(r.power, r.alpha);
      near(r.beta, 1 - r.alpha);
    }
  }
});

test("quadrupling n halves the SE, doubles peak density, and retains alpha", () => {
  for (const state of [mean, proportions]) {
    const base = M.derive(state);
    const larger = M.derive({ ...state, n: state.n * 4, n1: 2724, n2: 2724 });
    near(larger.se0, base.se0 / 2);
    near(larger.se1, base.se1 / 2);
    near(M.normalPDF(0) / larger.se0, 2 * M.normalPDF(0) / base.se0);
    near(larger.upper - larger.mean0, (base.upper - base.mean0) / 2);
    near(larger.alpha, base.alpha);
    assert.ok(larger.power > base.power);
  }
});

test("power rises with a stronger effect or larger alpha; beta falls", () => {
  const base = M.derive(mean);
  for (const state of [{ ...mean, mu1: 108 }, { ...mean, n: 100 }, { ...mean, sigma: 10 }, { ...mean, alpha: 0.1 }]) {
    const r = M.derive(state);
    assert.ok(r.power > base.power);
    assert.ok(r.beta < base.beta);
  }
  const cutoff = base.upper - 1;
  const alpha = M.alphaForCutoff(mean, cutoff);
  const dragged = M.derive({ ...mean, alpha });
  near(dragged.upper, cutoff);
  assert.ok(alpha > mean.alpha);
  assert.ok(dragged.beta < base.beta);
});

test("unequal sample sizes use weighted pooling and each group's variance", () => {
  const state = { ...proportions, n1: 120, n2: 300, p1: 0.2, p2: 0.35 };
  const r = M.derive(state);
  const pooled = (120 * 0.2 + 300 * 0.35) / 420;
  near(r.pooled, pooled);
  near(r.se0, Math.sqrt(pooled * (1 - pooled) * (1 / 120 + 1 / 300)));
  near(r.se1, Math.sqrt(0.2 * 0.8 / 120 + 0.35 * 0.65 / 300));
  near(r.power + r.beta, 1);
  assert.ok(M.derive({ ...proportions, p1: 0.01, n1: 20 }).warnings[0].includes("below 10"));
});

test("cutoff updates clamp alpha while preserving the chosen tail", () => {
  for (const tail of ["right", "left", "two"]) {
    const state = { ...mean, tail };
    const r = M.derive(state);
    near(M.alphaForCutoff(state, tail === "left" ? r.lower : r.upper), state.alpha);
    for (const cutoff of [-1e6, 1e6, state.mu0]) {
      const alpha = M.alphaForCutoff(state, cutoff);
      assert.ok(alpha >= 0.0001 && alpha <= 0.9999);
    }
  }
  assert.equal(M.alphaForCutoff({ ...mean, tail: "two" }, mean.mu0), 0.9999);
});

test("invalid state values fail explicitly instead of returning misleading curves", () => {
  for (const state of [null, [], { ...mean, n: 0 }, { ...mean, n: 2.5 }, { ...mean, n: Infinity },
    { ...mean, n: "50" }, { ...mean, sigma: 0 }, { ...mean, sigma: -1 }, { ...mean, mu0: NaN },
    { ...mean, alpha: 0 }, { ...mean, alpha: 1 }, { ...mean, alpha: NaN }, { ...mean, model: "t" },
    { ...mean, tail: "both" }, { ...proportions, p1: 0 }, { ...proportions, p2: 1 },
    { ...proportions, n2: -1 }, { ...proportions, p1: Infinity },
    { ...proportions, p1: Number.MIN_VALUE, p2: Number.MIN_VALUE, n1: Number.MAX_SAFE_INTEGER, n2: Number.MAX_SAFE_INTEGER }]) {
    assert.throws(() => M.derive(state), RangeError);
  }
  assert.throws(() => M.alphaForCutoff(mean, NaN), RangeError);
});

test("browser global works without Node and the input state remains unchanged", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve("../modules/power-error/power-math.js"), "utf8"), context);
  near(context.PowerMath.derive(mean).power, M.derive(mean).power);
  const state = Object.freeze({ ...mean });
  M.derive(state);
  M.alphaForCutoff(state, 102);
  assert.deepEqual(state, mean);
});
