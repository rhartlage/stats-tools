const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
      Math.exp(-x * x);
  return sign * y;
}

const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

function logGamma(z) {
  const c = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019571e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < c.length; i += 1) x += c[i] / (z + i + 1);
  const t = z + c.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaCf(a, b, x) {
  const max = 160;
  const eps = 3e-12;
  const fp = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fp) d = fp;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= max; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fp) d = fp;
    c = 1 + aa / c;
    if (Math.abs(c) < fp) c = fp;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fp) d = fp;
    c = 1 + aa / c;
    if (Math.abs(c) < fp) c = fp;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < eps) break;
  }
  return h;
}

function regBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaCf(a, b, x)) / a
    : 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let delta = sum;
    let ap = a;
    for (let n = 1; n < 180; n += 1) {
      ap += 1;
      delta *= x / ap;
      sum += delta;
      if (Math.abs(delta) < Math.abs(sum) * 3e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 180; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

const chiCdf = (x, df) => gammaP(df / 2, x / 2);
const fmt = (x, digits = 3) => (Number.isFinite(x) ? x.toFixed(digits) : "—");
const pFmt = (p) => (p < 0.001 ? "< .001" : p.toFixed(3));

const independenceIds = ["a", "b", "c", "d"];
const independenceDefaults = [18, 102, 32, 88];
const gofObservedIds = ["gofObs0", "gofObs1", "gofObs2", "gofObs3"];
const gofPercentIds = ["gofPct0", "gofPct1", "gofPct2", "gofPct3"];
const gofObservedDefaults = [18, 22, 35, 25];
const gofPercentDefaults = [25, 25, 25, 25];
const gofCategories = ["Billing", "Delivery", "Product", "Service"];

const ui = {
  analysisMode: document.querySelector("#analysisMode"),
  modeLede: document.querySelector("#modeLede"),
  modeContext: document.querySelector("#modeContext"),
  independenceInputs: document.querySelector("#independenceInputs"),
  gofInputs: document.querySelector("#gofInputs"),
  alpha: document.querySelector("#alpha"),
  expected: document.querySelector("#expected"),
  chi: document.querySelector("#chi"),
  p: document.querySelector("#p"),
  thirdMetricLabel: document.querySelector("#thirdMetricLabel"),
  thirdMetricValue: document.querySelector("#rr"),
  result: document.querySelector("#result"),
  cells: document.querySelector("#cells"),
  contributionsHeading: document.querySelector("#contributionsHeading"),
  focusQuestion: document.querySelector("#focusQuestion"),
  run: document.querySelector("#run"),
  reset: document.querySelector("#reset"),
};

let mode = new URLSearchParams(window.location.search).get("lab") === "gof" ? "gof" : "independence";

function numericValues(ids) {
  return ids.map((id) => Number(document.querySelector(`#${id}`).value));
}

function clearReadout() {
  ui.chi.textContent = "—";
  ui.p.textContent = "—";
  ui.thirdMetricValue.textContent = "—";
  ui.cells.textContent = "";
}

function showError(message) {
  clearReadout();
  ui.expected.className = "result error";
  ui.expected.innerHTML = `<h3>Check the inputs</h3><p>${message}</p>`;
  ui.result.className = "result error";
  ui.result.innerHTML =
    "<h3>Analysis not run</h3><p>Correct the inputs, then analyze the table again.</p>";
}

function expectedCountMessage(minimum) {
  const supported = minimum >= 5;
  ui.expected.className = `result ${supported ? "success" : "warning"}`;
  ui.expected.innerHTML = `<h3>${supported ? "Approximation supported" : "Use caution"}</h3>
    <p>Smallest expected count = ${fmt(minimum, 2)}. ${
      supported
        ? "All expected counts meet the common threshold of 5."
        : "At least one expected count is below 5; combine defensible categories or use an exact method."
    }</p>`;
}

function runIndependence() {
  const [a, b, c, d] = numericValues(independenceIds);
  const alpha = Number(ui.alpha.value);
  if (
    [a, b, c, d].some((x) => !Number.isFinite(x) || x < 0) ||
    a + b === 0 ||
    c + d === 0 ||
    a + c === 0 ||
    b + d === 0 ||
    !(alpha > 0 && alpha < 1)
  ) {
    showError("Counts must be nonnegative, margins positive, and alpha between 0 and 1.");
    return;
  }

  const observed = [
    [a, b],
    [c, d],
  ];
  const rowTotals = [a + b, c + d];
  const columnTotals = [a + c, b + d];
  const total = rowTotals[0] + rowTotals[1];
  const expected = rowTotals.map((row) => columnTotals.map((column) => (row * column) / total));
  let chiSquare = 0;
  const contributions = observed.map((row, i) =>
    row.map((value, j) => {
      const contribution = (value - expected[i][j]) ** 2 / expected[i][j];
      chiSquare += contribution;
      return contribution;
    }),
  );
  const pValue = clamp(1 - chiCdf(chiSquare, 1), 0, 1);
  const riskNew = a / rowTotals[0];
  const riskCurrent = c / rowTotals[1];
  const relativeRisk = riskCurrent === 0 ? Infinity : riskNew / riskCurrent;
  const minimumExpected = Math.min(...expected.flat());

  ui.chi.textContent = fmt(chiSquare);
  ui.p.textContent = pFmt(pValue);
  ui.thirdMetricValue.textContent = Number.isFinite(relativeRisk) ? fmt(relativeRisk, 2) : "∞";
  expectedCountMessage(minimumExpected);
  ui.result.className = "result";
  ui.result.innerHTML = `<h3>${
    pValue < alpha ? "Evidence of association" : "Insufficient evidence of association"
  }</h3>
    <p>Observed failure risk is ${(100 * riskNew).toFixed(1)}% for the new process and ${(100 * riskCurrent).toFixed(1)}% for the current process. Relative risk (new/current) = ${
      Number.isFinite(relativeRisk) ? fmt(relativeRisk, 2) : "∞"
    }.</p>
    <p>At α = ${alpha}, ${pValue < alpha ? "reject" : "do not reject"} independence. The table alone does not establish causation.</p>`;
  const names = [
    "New–failure",
    "New–no failure",
    "Current–failure",
    "Current–no failure",
  ];
  ui.cells.innerHTML = `<table><thead><tr><th>Cell</th><th>Observed</th><th>Expected</th><th>χ² contribution</th></tr></thead>
    <tbody>${names
      .map((name, k) => {
        const i = Math.floor(k / 2);
        const j = k % 2;
        return `<tr><td>${name}</td><td>${observed[i][j]}</td><td>${fmt(expected[i][j], 2)}</td><td>${fmt(contributions[i][j], 3)}</td></tr>`;
      })
      .join("")}</tbody></table>`;
}

function runGoodnessOfFit() {
  const observed = numericValues(gofObservedIds);
  const expectedPercentages = numericValues(gofPercentIds);
  const alpha = Number(ui.alpha.value);
  const percentageTotal = expectedPercentages.reduce((sum, value) => sum + value, 0);
  const total = observed.reduce((sum, value) => sum + value, 0);

  if (
    observed.some((x) => !Number.isFinite(x) || x < 0) ||
    expectedPercentages.some((x) => !Number.isFinite(x) || x <= 0) ||
    total <= 0 ||
    Math.abs(percentageTotal - 100) > 0.01 ||
    !(alpha > 0 && alpha < 1)
  ) {
    showError(
      "Observed counts must be nonnegative with a positive total, expected percentages must be positive and total 100%, and alpha must be between 0 and 1.",
    );
    return;
  }

  const expected = expectedPercentages.map((percentage) => (total * percentage) / 100);
  const contributions = observed.map((value, index) => (value - expected[index]) ** 2 / expected[index]);
  const chiSquare = contributions.reduce((sum, value) => sum + value, 0);
  const degreesOfFreedom = observed.length - 1;
  const pValue = clamp(1 - chiCdf(chiSquare, degreesOfFreedom), 0, 1);
  const minimumExpected = Math.min(...expected);

  ui.chi.textContent = fmt(chiSquare);
  ui.p.textContent = pFmt(pValue);
  ui.thirdMetricValue.textContent = String(degreesOfFreedom);
  expectedCountMessage(minimumExpected);
  ui.result.className = "result";
  ui.result.innerHTML = `<h3>${
    pValue < alpha ? "Evidence that the distribution differs" : "Insufficient evidence that the distribution differs"
  }</h3>
    <p>At α = ${alpha}, ${pValue < alpha ? "reject" : "do not reject"} the stated category model.</p>
    <p>Describe the pattern in the observed and expected counts; the test does not explain what caused any difference.</p>`;
  ui.cells.innerHTML = `<table><thead><tr><th>Category</th><th>Observed</th><th>Expected</th><th>χ² contribution</th></tr></thead>
    <tbody>${gofCategories
      .map(
        (name, index) =>
          `<tr><td>${name}</td><td>${observed[index]}</td><td>${fmt(expected[index], 2)}</td><td>${fmt(contributions[index], 3)}</td></tr>`,
      )
      .join("")}</tbody></table>`;
}

function run() {
  if (mode === "gof") runGoodnessOfFit();
  else runIndependence();
}

function resetCurrentMode() {
  const values = mode === "gof" ? gofObservedDefaults : independenceDefaults;
  const ids = mode === "gof" ? gofObservedIds : independenceIds;
  ids.forEach((id, index) => {
    document.querySelector(`#${id}`).value = values[index];
  });
  if (mode === "gof") {
    gofPercentIds.forEach((id, index) => {
      document.querySelector(`#${id}`).value = gofPercentDefaults[index];
    });
  }
  ui.alpha.value = 0.05;
  run();
}

function setMode(nextMode, updateUrl = true) {
  mode = nextMode === "gof" ? "gof" : "independence";
  const isGof = mode === "gof";
  ui.analysisMode.value = mode;
  ui.independenceInputs.classList.toggle("hidden", isGof);
  ui.gofInputs.classList.toggle("hidden", !isGof);
  ui.thirdMetricLabel.textContent = isGof ? "Degrees of freedom" : "Relative risk";
  ui.contributionsHeading.textContent = isGof ? "Category contributions" : "Cell contributions";
  ui.modeLede.textContent = isGof
    ? "Test whether observed category counts follow a stated business model, inspect which categories drive the result, and communicate the conclusion without overclaiming."
    : "Test categorical patterns with chi-square, inspect which cells drive the result, and translate association into transparent business risk language.";
  ui.modeContext.textContent = isGof
    ? "Use one categorical variable to compare observed counts with an expected distribution."
    : "Use a two-way table to test association and compare observed risks.";
  ui.focusQuestion.textContent = isGof
    ? "Compare the observed complaint mix with the expected model, state the statistical conclusion, and identify the category that contributes most to chi-square."
    : "Report the two observed risks, relative risk, statistical conclusion, and one sentence that avoids a causal overclaim.";
  if (updateUrl) {
    const nextUrl = new URL(window.location.href);
    if (isGof) nextUrl.searchParams.set("lab", "gof");
    else nextUrl.searchParams.delete("lab");
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }
  resetCurrentMode();
}

ui.run.addEventListener("click", run);
ui.reset.addEventListener("click", resetCurrentMode);
ui.analysisMode.addEventListener("change", () => setMode(ui.analysisMode.value));
setMode(mode, false);
