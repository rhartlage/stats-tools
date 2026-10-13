# Student t Distribution Explorer

Standalone, browser-local teaching tool intended for https://tools.benhartlage.com/t-distribution/.

Use integer df from 1 through 1,000,000; forward left/right/interval/equal two-tail areas; inverse signed one-sided cutoffs, centered intervals, and positive two-tail critical magnitudes. Includes dragging, keyboard-accessible numeric inputs/sliders and column resizing, worked mathematics, copyable Excel formulas, presets, predict/check, and print support. No accounts, storage, analytics, external fonts, network calls, or transmitted student data.

The df 5 / middle 95% preset produces ±2.570581835636314. Two tails 5% produces the same bounds. A right-tail area above 0.5 produces a negative signed cutoff.

Numerics use a regularized incomplete beta continued fraction, direct survival probabilities, log-domain extreme tails, and bracketed inversion. Central small areas and close finite intervals avoid subtracting nearly equal cumulative probabilities. Input values and calculations retain floating-point precision; display values are rounded. Probabilities can round to zero or one at machine limits, explicitly labeled. Inverse probabilities must be strictly between zero and one; unrepresentable quantiles and middle areas too small for Excel's `1-p` conversion are rejected. The graph expands to ±20; text and calculations include off-plot tails.

Run `node --test modules/t-distribution/tests/math.test.cjs` from the repository root. The committed fixture has 540 SciPy 1.17.0 PDF/CDF/SF/quantile references; `tests/generate-reference.py` regenerates it. Extreme df=1 inverse values additionally use analytic Cauchy tails because SciPy's quantile routine saturates near 1e100. Browser checks can run with `PLAYWRIGHT_MODULE=/path/to/playwright node modules/t-distribution/tests/browser.cjs URL` (Chromium at `/usr/bin/chromium`, overridable with `CHROMIUM_PATH`).

Sources checked for Excel semantics:
- https://support.microsoft.com/en-us/excel/functions/t-dist-rt-function
- https://support.microsoft.com/en-us/excel/functions/t-inv-2t-function

The publishing shell is `rhartlage/rhartlage.github.io`. Pin the committed source revision and allowlist `index.html`, `styles.css`, `t-math.js`, `t-model.js`, `app.js`, and `layout.js`. Do not copy tests into the public bundle. Layout and styling adapt the current `normal-area-explorer` source at `694d93fe3bd8b80bfd75fb0ab6dbb747b9154e45`.
