import { topics } from "./topics.mjs";
import { createSession, grade } from "./engine.mjs";
import { interval, simulate } from "./math.mjs";
const $ = (id) => document.getElementById(id),
  f = (x, d = 3) => x.toFixed(d);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let seed = 1025,
  session = createSession(topics[0], seed),
  view = "guided",
  rows = [],
  drawSeed = 101,
  totalSamples = 0,
  totalCovered = 0;
$("topic").innerHTML = topics
  .map(
    (t) =>
      `<option value="${escape(t.id)}" ${t.available ? "" : "disabled"}>${escape(t.label)}</option>`,
  )
  .join("");
const current = () => session.states[session.index];
function capture() {
  if (session.index >= session.steps.length) return;
  const answers = {};
  for (const [k, v] of new FormData($("answer-form"))) answers[k] = String(v);
  current().answers = answers;
}
function renderProgress() {
  const count = session.states.filter((s) => s.resolved).length;
  $("progress").max = session.steps.length;
  $("progress").value = count;
  $("progress-text").textContent =
    `${count} of ${session.steps.length} questions explored`;
  const phases = [...new Set(session.steps.map((s) => s.phase))];
  $("journey").innerHTML = phases
    .map((phase, i) => {
      const indices = session.steps
          .map((s, j) => (s.phase === phase ? j : -1))
          .filter((j) => j >= 0),
        done = indices.every((j) => session.states[j].resolved),
        active = indices.includes(session.index);
      return `<li ${active ? 'aria-current="step"' : ""}>${i + 1}. ${phase}<span>${done ? "✓ Explored" : active ? "In progress" : ""}</span></li>`;
    })
    .join("");
}
function companion(link) {
  $("companion").hidden = !link;
  $("companion").innerHTML = link
    ? `<p><strong>Explore the idea another way</strong></p><p>${escape(link.why)}</p><a href="${escape(link.href)}" target="_blank" rel="noopener noreferrer">${escape(link.label)} ↗ <span class="sr-only">(opens in a new tab)</span></a>`
    : "";
}
function renderFeedback() {
  const step = session.steps[session.index],
    state = current();
  $("feedback").textContent = state.feedback;
  $("feedback").className = state.tone;
  for (const field of step.fields ?? []) {
    const result = state.fields[field.key],
      input = $("answer-" + field.key),
      output = $("feedback-" + field.key);
    output.textContent = result?.message ?? "";
    output.className =
      "field-feedback " +
      (result ? (result.correct ? "success" : "error") : "");
    if (result && !result.correct) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
  $("hint-content").innerHTML = step.hints
    .slice(0, state.hints)
    .map((hint, i) => `<p><strong>Hint ${i + 1}.</strong> ${escape(hint)}</p>`)
    .join("");
  if (state.reviewed)
    $("hint-content").innerHTML +=
      `<p><strong>Worked explanation.</strong> ${escape(step.worked)}</p>`;
  $("hint").disabled = state.hints >= step.hints.length;
  $("hint").textContent =
    state.hints >= step.hints.length
      ? "All hints shown"
      : state.hints
        ? "Give me another hint"
        : "Give me a hint";
  $("next").disabled = !state.resolved;
  renderProgress();
}
function renderQuestion(focus = false) {
  const p = session.problem;
  $("scenario-text").textContent =
    `We want to estimate the mean measurement for ${p.population}. A random sample of ${p.n} ${p.item} has a mean of ${p.mean.toFixed(2)} ${p.unit} and a sample standard deviation of ${p.sd.toFixed(2)} ${p.unit}. Build a ${Math.round(p.confidence * 100)}% confidence interval for the population mean.`;
  $("problem-id").textContent = `Problem ${p.seed}`;
  $("givens").innerHTML = [
    ["Sample size n", p.n],
    ["Sample mean x̄", p.mean.toFixed(2)],
    ["Sample SD s", p.sd.toFixed(2)],
    ["Confidence", `${Math.round(p.confidence * 100)}%`],
  ]
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
  const complete = session.index >= session.steps.length;
  $("complete").hidden = !complete;
  $("question-card").hidden = complete;
  if (complete) {
    const answered = session.states.filter((s) => s.correct).length;
    $("complete").innerHTML =
      `<p class="eyebrow">ONE INTERVAL. A COMPLETE ARGUMENT.</p><h2 id="complete-title" tabindex="-1">You’ve connected the pieces.</h2><p>Your ${Math.round(p.confidence * 100)}% interval is <strong>[${f(p.lower)}, ${f(p.upper)}] ${escape(p.unit)}</strong> for the mean of ${escape(p.population)}.</p><p>You answered ${answered} questions correctly and explored ${session.steps.length - answered} through explanations. This is practice, not a grade.</p><p>Before you move on, explain to yourself why this interval is about a population mean, how sampling supports it, and what the confidence level describes.</p><div class="help-row"><button id="complete-fresh">Practice with a fresh problem</button><button id="complete-review" class="secondary">Review this problem</button></div><aside class="companion"><p><strong>Apply your interval to a business decision</strong></p><p>The Inference &amp; Decision Lab is a companion calculator and decision lab. Choose Mean (t) to explore a one-mean interval and test.</p><a href="https://tools.benhartlage.com/inference-decision/" target="_blank" rel="noopener noreferrer">Open Inference &amp; Decision Lab ↗ (new tab)</a></aside>`;
    $("complete-fresh").onclick = () => restart(true);
    $("complete-review").onclick = () => navigate(0);
    renderProgress();
    if (focus) $("complete-title").focus();
    return;
  }
  const step = session.steps[session.index],
    state = current();
  $("step-label").textContent = `${step.phase} · Question ${session.index + 1}`;
  $("question-title").textContent = step.title;
  $("question-prompt").textContent = step.prompt;
  $("answer-fields").innerHTML =
    step.kind === "choice"
      ? `<fieldset><legend class="sr-only">${escape(step.prompt)}</legend>${state.order.map((i) => `<label class="option"><input type="radio" name="choice" value="${i}" ${state.answers.choice === String(i) ? "checked" : ""}><span>${escape(step.options[i])}</span></label>`).join("")}</fieldset>`
      : step.fields
          .map(
            (field) =>
              `<div class="numeric-field"><label for="answer-${field.key}">${escape(field.label)}</label><input id="answer-${field.key}" name="${field.key}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${escape(state.answers[field.key] ?? "")}" aria-describedby="feedback-${field.key}"><span id="feedback-${field.key}" class="field-feedback"></span></div>`,
          )
          .join("");
  $("previous").disabled = session.index === 0;
  $("next").textContent =
    session.index === session.steps.length - 1
      ? "Finish practice →"
      : "Next question →";
  $("step-count").textContent =
    `${session.index + 1} / ${session.steps.length}`;
  companion(step.link);
  renderFeedback();
  if (focus) $("question-title").focus();
}
function navigate(index) {
  capture();
  session.index = index;
  renderQuestion(true);
}
function restart(fresh = false) {
  if (fresh) seed += 1;
  session = createSession(
    topics.find((t) => t.id === $("topic").value),
    seed,
  );
  setView("guided", false, false);
  renderQuestion(true);
}
$("answer-form").addEventListener("submit", (event) => {
  event.preventDefault();
  capture();
  const state = current(),
    result = grade(session.steps[session.index], state.answers);
  if (result.valid) state.attempts++;
  state.correct = result.correct;
  state.resolved = result.correct || state.reviewed;
  state.feedback = result.feedback;
  state.fields = result.fields;
  state.tone = result.correct ? "success" : "";
  renderFeedback();
});
$("answer-form").addEventListener("input", () => {
  capture();
  const state = current();
  state.correct = false;
  state.resolved = state.reviewed;
  state.feedback = "";
  state.fields = {};
  state.tone = "";
  renderFeedback();
});
$("hint").onclick = () => {
  current().hints++;
  renderFeedback();
};
$("worked").onclick = () => {
  const s = current();
  s.reviewed = true;
  s.resolved = true;
  s.feedback =
    "Explanation opened. Read it, then try answering or continue. You can revisit this question.";
  s.tone = "review";
  renderFeedback();
};
$("previous").onclick = () => navigate(Math.max(0, session.index - 1));
$("next").onclick = () => {
  if (current().resolved) navigate(session.index + 1);
};
$("fresh").onclick = () => restart(true);
$("reset").onclick = () => restart();
$("topic").onchange = () => restart();
function setView(next, focus = true, preserve = true) {
  if (preserve) capture();
  view = next;
  for (const name of ["guided", "width", "sampling"])
    $(name + "-view").hidden = name !== view;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === view)),
    );
  if (focus)
    $(
      view === "guided"
        ? session.index >= session.steps.length
          ? "complete-title"
          : "question-title"
        : view === "width"
          ? "width-title"
          : "sampling-title",
    ).focus();
}
for (const button of document.querySelectorAll("[data-view]"))
  button.onclick = () => setView(button.dataset.view);
function widthLab() {
  const n = Number($("width-n").value),
    sd = Number($("width-sd").value),
    confidence = Number($("width-confidence").value),
    result = interval({ n, sd, confidence, mean: 50 }),
    base = interval({ n: 25, sd: 10, confidence: 0.95, mean: 50 });
  $("width-n-value").textContent = n;
  $("width-sd-value").textContent = sd;
  const max = Math.max(result.margin, base.margin) * 1.35,
    x = (v) => 300 + ((v - 50) * 240) / max;
  $("width-chart").innerHTML =
    `<svg viewBox="0 0 600 180" role="img" aria-label="Baseline interval width ${f(base.width)}; current interval width ${f(result.width)}. Each centered on 50."><line x1="300" y1="25" x2="300" y2="155" stroke="#999" stroke-dasharray="4 4"/><text x="300" y="18" text-anchor="middle">50</text>${[
      [base, 65, "Baseline: n 25 · s 10 · 95%", "#777b91"],
      [result, 135, "Current comparison", "#354ab9"],
    ]
      .map(
        ([r, y, label, color]) =>
          `<text x="20" y="${y - 23}">${label}</text><line x1="${x(r.lower)}" x2="${x(r.upper)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="6"/><circle cx="300" cy="${y}" r="6" fill="${color}"/><text x="${x(r.lower)}" y="${y + 22}" text-anchor="middle">${f(r.lower)}</text><text x="${x(r.upper)}" y="${y + 22}" text-anchor="middle">${f(r.upper)}</text>`,
      )
      .join("")}</svg>`;
  $("width-result").textContent =
    `Current interval: [${f(result.lower)}, ${f(result.upper)}]. Width ${f(result.width)}; ${f(result.width / base.width, 2)} times the baseline width. SE = ${f(result.se)}, t* = ${f(result.t)}, df = ${n - 1}.`;
}
for (const id of ["width-n", "width-sd", "width-confidence"])
  $(id).oninput = widthLab;
$("width-reset").onclick = () => {
  $("width-n").value = 25;
  $("width-sd").value = 10;
  $("width-confidence").value = 0.95;
  widthLab();
};
function renderSamples() {
  const misses = totalSamples - totalCovered;
  $("simulation-summary").textContent = totalSamples
    ? `${totalCovered} of ${totalSamples} intervals contain μ = 50 (${f((100 * totalCovered) / totalSamples, 1)}%); ${misses} miss. Target long-run coverage: ${Number($("sim-confidence").value) * 100}%.`
    : "No samples yet. Draw one sample to start, or draw a batch of 100.";
  const max =
      Math.max(
        12,
        ...rows.flatMap((r) => [
          Math.abs(r.lower - 50),
          Math.abs(r.upper - 50),
        ]),
      ) * 1.1,
    x = (v) => 330 + ((v - 50) * 240) / max,
    height = Math.max(160, rows.length * 17 + 65);
  $("sampling-chart").innerHTML =
    `<svg viewBox="0 0 660 ${height}" role="img" aria-label="Latest ${rows.length} confidence intervals, shown against fixed population mean 50. Exact values and coverage are in the table below."><text x="${x(50)}" y="18" text-anchor="middle">Fixed μ = 50</text><line x1="${x(50)}" x2="${x(50)}" y1="25" y2="${height - 25}" stroke="#191d4c" stroke-width="2"/>${rows
      .map((r, i) => {
        const y = i * 17 + 37,
          color = r.covers ? "#354ab9" : "#9a2845";
        return `<text x="12" y="${y + 4}">${totalSamples - rows.length + i + 1}</text><line x1="${x(r.lower)}" x2="${x(r.upper)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="2" ${r.covers ? "" : 'stroke-dasharray="5 3"'}/>${r.covers ? `<circle cx="${x(r.mean)}" cy="${y}" r="3" fill="${color}"/>` : `<text x="${x(r.mean)}" y="${y + 5}" text-anchor="middle">×</text>`}`;
      })
      .join(
        "",
      )}<text x="${x(50 - max)}" y="${height - 7}" text-anchor="middle">${f(50 - max, 1)}</text><text x="${x(50 + max)}" y="${height - 7}" text-anchor="middle">${f(50 + max, 1)}</text></svg>`;
  $("samples-table").innerHTML = rows
    .map(
      (r, i) =>
        `<tr><th scope="row">${totalSamples - rows.length + i + 1}</th><td>${f(r.mean)}</td><td>${f(r.sd)}</td><td>${f(r.lower)}</td><td>${f(r.upper)}</td><td>${r.covers ? "Yes" : "No — misses"}</td></tr>`,
    )
    .join("");
}
function draw(count) {
  const batch = simulate({
    n: Number($("sim-n").value),
    confidence: Number($("sim-confidence").value),
    count,
    seed: drawSeed++,
  });
  totalSamples += count;
  totalCovered += batch.filter((r) => r.covers).length;
  rows = rows.concat(batch).slice(-30);
  renderSamples();
}
function resetSamples() {
  rows = [];
  totalSamples = 0;
  totalCovered = 0;
  drawSeed = 101;
  renderSamples();
}
$("sample-one").onclick = () => draw(1);
$("sample-hundred").onclick = () => draw(100);
$("sim-reset").onclick = resetSamples;
$("sim-n").onchange = resetSamples;
$("sim-confidence").onchange = resetSamples;
renderQuestion();
widthLab();
renderSamples();
