# Statistics Tutor v1

Optional, browser-only Socratic-style practice. First topic: two-sided confidence intervals for one population mean when the population SD is unknown. No API, accounts, keys, analytics, cookies, browser storage, or student-response transmission. Progress exists only in memory and clears on reload/close. Companion links open new tabs without query parameters.

## Architecture and extension

- `topics.mjs`: implemented-topic registry, seeded problem factory, authored questions, misconception feedback, hints, worked explanations, contextual companion links. Only available topics are selectable. The `futureTopics` list is a backlog, not an implemented curriculum.
- `engine.mjs`: generic session creation, deterministic option shuffling, and independent field grading. A new topic provides `id`, `label`, `available`, `makeProblem(seed)`, and `steps(problem)` using the choice/numeric schema. Add the new module to the deployment allowlist if split into another file.
- `math.mjs`: incomplete-beta Student t CDF/inversion; unrounded interval calculations; strict input parsing and rounding checks; independent normal samples with recomputed sample SD.
- `app.mjs`: in-memory navigation and rendering, independent width comparison, finite sampling actions. No animations or timed responses. Chart statuses have text/table equivalents.
- `index.html` / `styles.css`: responsive native controls, keyboard focus, live feedback, accessible topic selection, reduced-motion and print styles.

Problems use displayed means and SDs (two decimals), positive SDs, n in 16/25/36/49/64 and 90/95/99% confidence. The first seed is 1025; fresh problems increment it. Simulation seeds start at 101 and reset with each parameter change. Count includes all generated samples; chart/table retain the latest 30 in memory. Finite batches are not forced to match nominal coverage. Computation supports n=2 for numerical validation, but lessons never present that as generally adequate inference.

## Validation

```sh
node --test tests/statistics-tutor.test.mjs
python3 -m http.server 4174 --bind 127.0.0.1
# In another shell, with an existing Playwright installation and Chromium:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROMIUM_PATH=/usr/bin/chromium node tests/statistics-tutor.browser.mjs
# Set TUTOR_URL to exercise the composed public shell instead of source HTML.
```

Eight numerical/content/engine tests cover five independent reference intervals (including df=1), invalid input, rounding, 1,000 coherent randomized problems, independent component grading, shuffled choices, 10,000 repeated samples, and display-rounding propagation across 10,000 exercises. Browser tests exercise complete correct and misconception/hint paths, blank/invalid inputs, repeated submissions, previous/next, reset/fresh, both labs, view-state retention, topic control, keyboard operation, mobile overflow, reload, no retained responses and no external requests. Screenshots and JSON receipts are written to `TUTOR_QA_DIR` (default `/tmp/tutor-qa`). No lint/typecheck/build system is needed for the source; all ES modules are syntax checked. The public shell has its own build, validator, secret check and Wrangler dry run.

Independent review caught and corrected stale answer capture on reset, missing live hint announcements, and sampling chart label alignment. Desktop/mobile browser QA must also run on the composed shell because its shared styles can affect tools.

## Existing tools are complementary

Public links independently smoke-tested October 28, 2026:

| Companion | Tutor placement | Distinct role |
| --- | --- | --- |
| [Study Design & Bias Lab](https://tools.benhartlage.com/study-design-bias/) | Sampling conditions / bias | Explore sampling design and bias |
| [Sampling Distribution Explorer](https://tools.benhartlage.com/sampling-distribution/) | Standard error / width prediction | Simulate the distribution of sample means |
| [Student t Distribution Explorer](https://tools.benhartlage.com/t-distribution/) | Method / critical value | Explore df and middle/tail areas |
| [Inference & Decision Lab](https://tools.benhartlage.com/inference-decision/) | Interpretation / completion | Use Mean (t) for calculations and business decisions |

The tutor provides guided reasoning and targeted feedback. Existing explorers and decision labs retain their open-ended experimentation/calculation roles. This release retires or changes none of them. No deep-link parameter contract is assumed. Future tutoring might provide a guided entry point to these apps, not replace their exploratory functions.

## Future topic backlog (not implemented)

1. One-proportion confidence intervals.
2. One-sample hypothesis tests for a mean or proportion.
3. Comparing two groups (independent means, paired data, proportions).
4. Regression and correlation.
5. Categorical inference.
6. One-way ANOVA.
7. Sampling distributions.
8. Choosing an inference method.

Use future modules' existing complementary labs where applicable. Current release intentionally does not link the known-sigma Power & Error model into this unknown-sigma t lesson.

## Statistical reference

[NIST: Confidence Limits for the Mean](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm). Confidence describes long-run procedure coverage, not probability assigned to a fixed mean after an interval is observed. These are mean intervals, not ranges for individual observations. Bigger samples improve precision under the stated assumptions; they do not repair selection bias.
