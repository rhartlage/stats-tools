const regionType = document.getElementById("regionType");
const aSlider = document.getElementById("aSlider");
const bSlider = document.getElementById("bSlider");
const aValue = document.getElementById("aValue");
const bValue = document.getElementById("bValue");
const bControl = document.getElementById("bControl");
const questionText = document.getElementById("questionText");
const answerText = document.getElementById("answerText");
const normalSvg = document.getElementById("normalSvg");

const xMin = -3.7;
const xMax = 3.7;
const yScale = 620;

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const poly = (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t);
  const approx = 1 - poly * Math.exp(-absX * absX);
  return sign * approx;
}

function cdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function pdf(z) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-(z * z) / 2);
}

function toX(z) {
  return ((z - xMin) / (xMax - xMin)) * 900;
}

function toY(density) {
  return 320 - density * yScale;
}

function pathForCurve(step = 0.02) {
  let d = "";
  for (let z = xMin; z <= xMax; z += step) {
    const x = toX(z);
    const y = toY(pdf(z));
    d += d === "" ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

function shadePath(fromZ, toZ, step = 0.02) {
  const left = Math.max(xMin, Math.min(fromZ, toZ));
  const right = Math.min(xMax, Math.max(fromZ, toZ));
  let d = `M ${toX(left).toFixed(2)} 320`;
  for (let z = left; z <= right; z += step) {
    d += ` L ${toX(z).toFixed(2)} ${toY(pdf(z)).toFixed(2)}`;
  }
  d += ` L ${toX(right).toFixed(2)} 320 Z`;
  return d;
}

function fmt(z) {
  return Number(z).toFixed(2);
}

function update() {
  const type = regionType.value;
  let a = Number(aSlider.value);
  let b = Number(bSlider.value);

  if (type === "between" && a > b) {
    [a, b] = [b, a];
  }

  aValue.textContent = fmt(a);
  bValue.textContent = fmt(b);
  bControl.style.display = type === "between" ? "grid" : "none";

  let percent = 0;
  let question = "";
  let shaded = "";

  if (type === "right") {
    percent = 1 - cdf(a);
    question = `Find P(z > ${fmt(a)})`;
    shaded = shadePath(a, xMax);
  } else if (type === "left") {
    percent = cdf(a);
    question = `Find P(z < ${fmt(a)})`;
    shaded = shadePath(xMin, a);
  } else if (type === "between") {
    percent = cdf(b) - cdf(a);
    question = `Find P(${fmt(a)} < z < ${fmt(b)})`;
    shaded = shadePath(a, b);
  } else {
    const aa = Math.abs(a);
    percent = (1 - cdf(aa)) + cdf(-aa);
    question = `Find P(|z| > ${fmt(aa)})`;
    shaded = `${shadePath(xMin, -aa)} ${shadePath(aa, xMax)}`;
  }

  questionText.textContent = question;
  answerText.textContent = `Area ≈ ${(percent * 100).toFixed(2)}%`;

  const axisY = 320;
  const axis = `<line x1="30" y1="${axisY}" x2="870" y2="${axisY}" stroke="#71839f" stroke-width="2" />`;
  const zeroTick = `<line x1="${toX(0)}" y1="${axisY - 8}" x2="${toX(0)}" y2="${axisY + 8}" stroke="#53647e"/>`;
  const labels = `
    <text x="${toX(-3)}" y="345" font-size="16" fill="#44536a">-3</text>
    <text x="${toX(0) - 4}" y="345" font-size="16" fill="#44536a">0</text>
    <text x="${toX(3) - 4}" y="345" font-size="16" fill="#44536a">3</text>
  `;
  const shade = `<path d="${shaded}" fill="var(--shade)" stroke="none" />`;
  const curve = `<path d="${pathForCurve()}" fill="none" stroke="var(--accent)" stroke-width="3"/>`;

  normalSvg.innerHTML = `${axis}${zeroTick}${labels}${shade}${curve}`;
}

aSlider.addEventListener("input", update);
bSlider.addEventListener("input", update);
regionType.addEventListener("change", update);

for (const btn of document.querySelectorAll(".examples button")) {
  btn.addEventListener("click", () => {
    regionType.value = btn.dataset.type;
    if (btn.dataset.a) {
      aSlider.value = btn.dataset.a;
    }
    if (btn.dataset.b) {
      bSlider.value = btn.dataset.b;
    }
    update();
  });
}

update();
