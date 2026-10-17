# Power & Error Explorer

Browser-local design explorer for the raw sampling distribution of a mean with known population SD and an optional two-independent-proportion normal planning approximation. Runtime allowlist: `index.html`, `styles.css`, `power-math.js`, `app.js`. No runtime dependencies, storage, analytics, or data transmission.

## Models and reference checks

`power-math.js` exports the same pure API through `window.PowerMath` and CommonJS. All probabilities come from normal CDF calculations, never plotted pixels. The two-sided decision rule splits alpha equally and mirrors raw cutoffs around the null. Sample-size edits hold alpha and the horizontal plotting scale fixed; cutoff edits hold the design fixed and update alpha.

For a mean, SE = sigma/sqrt(n). Both sampling distributions have that SE, with centers mu0 and mu1. The known-sigma normal model is exact for independent normal observations; other populations require a suitable approximation. Unknown-sigma t and chi-square variance power are not implemented.

For independent proportions, D = pHat2-pHat1. The fixed planning null rate is pBar = (n1*p1+n2*p2)/(n1+n2). SE0 = sqrt(pBar*(1-pBar)*(1/n1+1/n2)); SE1 = sqrt(p1*(1-p1)/n1+p2*(1-p2)/n2). This uses an untransformed normal approximation without continuity correction, not Cohen h, an exact binomial test, or a realized random-denominator pooled z test.

Reference: p1=.14, p2=.19, n1=n2=681, right tail, alpha=.05 gives SE0=.02011530638, SE1=.02006962916, cutoff=.03308673465, power=.80031008307. The supplied formula table is used as a teaching reference for selecting a model, not as a claim that t or chi-square power is implemented.

## Validation

Run `node --test tests/power-math.test.cjs` from the source repository. Tests cover independent numerical fixtures, both tails of two-sided power, wrong-direction effects, zero effects, the independent-proportions reference, unequal sample sizes, sample-size/SE scaling, inverse-normal round trips, and invalid inputs.

Browser release checks should cover numeric input, mouse/touch/keyboard bars, symmetric cutoffs, retained alpha on sample-size changes, stable raw axis and doubled peak density when n quadruples, all shading modes, validation, reset, presets, formulas, repeated-sampling interpretations, print, and 320px through projector-width layouts. Null and wrong-direction cases show rejection/non-rejection labels rather than claiming power against an actual alternative.

## Release boundary

Publish via the existing `rhartlage/rhartlage.github.io` composition mechanism, pinning an exact source commit for the four runtime files. Preserve all existing pins and today's inference release. The public route is `/power-error/`; discovery links belong in the main statistics directory and BUS-2150 page. No hosting routes, credentials, policies, or unrelated applications need modification.
