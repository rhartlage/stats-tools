import test from "node:test";
import assert from "node:assert/strict";
import {
  interval,
  tCDF,
  tCritical,
  simulate,
  numberFrom,
  closeEnough,
} from "../modules/statistics-tutor/math.mjs";
import { topics, makeProblem } from "../modules/statistics-tutor/topics.mjs";
import { createSession, grade } from "../modules/statistics-tutor/engine.mjs";
const near = (a, b, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
test("independent t interval reference cases, including df=1 and negative endpoints", () => {
  const cases = [
    [
      { n: 25, mean: 1.02, sd: 0.1, confidence: 0.95 },
      2.063898562,
      0.041277971,
      0.978722029,
      1.061277971,
    ],
    [
      { n: 10, mean: 50, sd: 8, confidence: 0.95 },
      2.262157163,
      5.722855248,
      44.277144752,
      55.722855248,
    ],
    [
      { n: 30, mean: 100, sd: 12, confidence: 0.9 },
      1.699127027,
      3.722600802,
      96.277399198,
      103.722600802,
    ],
    [
      { n: 100, mean: 10, sd: 2, confidence: 0.99 },
      2.626405457,
      0.525281091,
      9.474718909,
      10.525281091,
    ],
    [
      { n: 2, mean: 0, sd: 1, confidence: 0.95 },
      12.706204736,
      8.984643532,
      -8.984643532,
      8.984643532,
    ],
  ];
  for (const [input, t, margin, lower, upper] of cases) {
    const actual = interval(input);
    near(actual.t, t);
    near(actual.margin, margin);
    near(actual.lower, lower);
    near(actual.upper, upper);
    assert.equal(actual.df, input.n - 1);
  }
});
test("CDF symmetry, monotonic critical values and width relationships", () => {
  near(tCDF(0, 1), 0.5);
  near(tCDF(1, 1), 0.75);
  near(tCritical(0.95, 5), 2.5705818356);
  for (const df of [1, 4, 24, 99, 999]) {
    near(tCDF(-2, df), 1 - tCDF(2, df));
    assert(tCritical(0.9, df) < tCritical(0.95, df));
    assert(tCritical(0.95, df) < tCritical(0.99, df));
  }
  const input = { n: 25, mean: 50, sd: 10, confidence: 0.95 },
    base = interval(input);
  assert(interval({ ...input, n: 100 }).width < base.width / 2);
  near(interval({ ...input, sd: 20 }).width, 2 * base.width);
  assert(interval({ ...input, confidence: 0.99 }).width > base.width);
});
test("reject invalid numeric data and partial parsing", () => {
  for (const value of [
    "",
    " ",
    null,
    undefined,
    "10abc",
    "1,000",
    "Infinity",
    Infinity,
    NaN,
    "0x10",
  ])
    assert(Number.isNaN(numberFrom(value)));
  assert.equal(numberFrom(" -.123e2 "), -12.3);
  const input = { n: 25, mean: 50, sd: 10, confidence: 0.95 };
  for (const bad of [
    { n: 1 },
    { n: 2.2 },
    { n: NaN },
    { sd: -1 },
    { sd: Infinity },
    { mean: NaN },
    { confidence: 1 },
    { confidence: 0 },
    { confidence: -0.5 },
    { confidence: NaN },
  ])
    assert.throws(() => interval({ ...input, ...bad }), RangeError);
  for (const [c, df] of [
    [1, 5],
    [0.95, 0],
    [0.95, 1.1],
    [NaN, 5],
  ])
    assert.throws(() => tCritical(c, df));
});
test("rounding accepts correctly rounded values and rejects nearby wrong answers", () => {
  assert(closeEnough("1.235", 1.23456, 3));
  assert(!closeEnough("1.236", 1.23456, 3));
  assert(!closeEnough("", 0, 3));
  assert(!closeEnough("1.235x", 1.23456, 3));
  assert(!closeEnough("Infinity", 0));
});
test("1000 generated exercises use coherent displayed values and a valid topic registry", () => {
  assert.equal(topics.length, 1);
  assert.equal(topics[0].available, true);
  const contexts = new Set(),
    confidences = new Set(),
    sizes = new Set(),
    correctPositions = new Set();
  for (let seed = 1000; seed < 2000; seed++) {
    const p = makeProblem(seed);
    assert.deepEqual(p, makeProblem(seed));
    assert(p.sd > 0);
    assert(p.n >= 16);
    assert.equal(p.mean, Number(p.mean.toFixed(2)));
    assert.equal(p.sd, Number(p.sd.toFixed(2)));
    near(p.lower, p.mean - (p.t * p.sd) / Math.sqrt(p.n));
    contexts.add(p.item);
    confidences.add(p.confidence);
    sizes.add(p.n);
    const s = createSession(topics[0], seed);
    assert.equal(s.steps.length, 12);
    assert(
      s.states.every(
        (x) => !x.resolved && !x.hints && !Object.keys(x.answers).length,
      ),
    );
    for (const [i, step] of s.steps.entries()) {
      if (step.kind === "choice") {
        correctPositions.add(s.states[i].order.indexOf(step.correct));
        assert(grade(step, { choice: String(step.correct) }).correct);
        for (let j = 0; j < step.options.length; j++)
          if (j !== step.correct)
            assert(!grade(step, { choice: String(j) }).correct);
        assert(!grade(step, {}).valid);
      } else {
        const answers = Object.fromEntries(
          step.fields.map((f) => [f.key, f.value.toFixed(f.decimals)]),
        );
        assert(grade(step, answers).correct);
        assert(!grade(step, {}).valid);
      }
    }
  }
  assert.equal(contexts.size, 4);
  assert.equal(confidences.size, 3);
  assert.equal(sizes.size, 5);
  assert.equal(correctPositions.size, 3);
});
test("numeric intermediate components are independently graded with misconception feedback", () => {
  const s = createSession(topics[0], 1025),
    sample = s.steps.find((x) => x.id === "sample");
  const result = grade(sample, { n: String(s.problem.n), mean: "999" });
  assert(result.fields.n.correct);
  assert(!result.fields.mean.correct);
  assert(
    !grade(sample, {
      n: String(s.problem.n + 0.1),
      mean: String(s.problem.mean),
    }).valid,
  );
  const se = s.steps.find((x) => x.id === "se");
  assert.match(
    grade(se, { se: String(s.problem.sd) }).fields.se.message,
    /individual/,
  );
  assert.match(
    grade(se, { se: String(s.problem.sd / s.problem.n) }).fields.se.message,
    /not n/,
  );
});
test("simulation recomputes sample SD, has reproducible non-forced coverage and independent samples", () => {
  const rows = simulate({ count: 10000, seed: 2026 });
  assert.deepEqual(rows.slice(0, 100), simulate({ count: 100, seed: 2026 }));
  const coverage = rows.filter((r) => r.covers).length / rows.length;
  assert(coverage > 0.94 && coverage < 0.96);
  assert.notEqual(rows[0].mean, rows[1].mean);
  assert.notEqual(rows[0].sd, rows[1].sd);
  assert(rows.some((r) => !r.covers));
  assert.notEqual(
    simulate({ count: 100, seed: 101 }).filter((r) => r.covers).length,
    95,
  );
  for (const r of rows.slice(0, 100)) {
    near(r.upper - r.mean, (tCritical(0.95, 24) * r.sd) / 5);
    assert.equal(r.covers, r.lower <= 50 && r.upper >= 50);
  }
});

test("displayed critical value rounding never penalizes valid calculations across 10000 exercises", () => {
  for (let seed = 0; seed < 10000; seed++) {
    const session = createSession(topics[0], seed),
      p = session.problem,
      m = (Number(p.t.toFixed(6)) * p.sd) / Math.sqrt(p.n);
    assert(
      grade(
        session.steps.find((x) => x.id === "margin"),
        { margin: m.toFixed(3) },
      ).correct,
      `margin seed ${seed}`,
    );
    assert(
      grade(
        session.steps.find((x) => x.id === "bounds"),
        { lower: (p.mean - m).toFixed(3), upper: (p.mean + m).toFixed(3) },
      ).correct,
      `bounds seed ${seed}`,
    );
    assert(
      !grade(
        session.steps.find((x) => x.id === "margin"),
        { margin: (m + 0.002).toFixed(3) },
      ).correct,
    );
  }
});
