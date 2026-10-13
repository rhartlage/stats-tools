"""Regenerate committed reference values with SciPy 1.17.0 (test only)."""
from pathlib import Path
import json
from scipy.stats import t
rows = []
for df in [1, 2, 3, 5, 10, 30, 100, 1000, 1000000]:
    for x in [-1e100, -100, -20, -5, -2, -.1, -1e-10, 0, 1e-10, .1, 2, 5, 20, 100, 1e100]:
        for f in ['cdf', 'sf', 'pdf']:
            rows.append([f, x, df, float(getattr(t, f)(x, df))])
    for p in [1e-100, 1e-20, 1e-12, .0001, .025, .25, .49999999, .5, .975, 1-1e-12]:
        rows.append(['inv', p, df, float(t.ppf(p, df))])
    for p in [1e-10, .01, .5, .95, .999999999999]:
        rows.append(['central', p, df, float(t.isf((1-p)/2, df))])
Path(__file__).with_name('scipy-reference.json').write_text(json.dumps(rows, indent=2) + '\n')
