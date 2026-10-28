import { interval, random } from "./math.mjs";
const f = (x) => x.toFixed(3);
const links = {
  sampling: {
    href: "https://tools.benhartlage.com/sampling-distribution/",
    label: "Sampling Distribution Explorer",
    why: "Watch sample means vary and connect their spread to standard error.",
  },
  design: {
    href: "https://tools.benhartlage.com/study-design-bias/",
    label: "Study Design & Bias Lab",
    why: "Investigate why a bigger sample cannot repair a biased sampling method.",
  },
  t: {
    href: "https://tools.benhartlage.com/t-distribution/",
    label: "Student t Distribution Explorer",
    why: "Explore degrees of freedom and the middle area behind a t critical value.",
  },
  inference: {
    href: "https://tools.benhartlage.com/inference-decision/",
    label: "Inference & Decision Lab",
    why: "Choose Mean (t) to apply a completed interval to a business decision and compare it with a hypothesis test.",
  },
};
export function makeProblem(seed = 1025) {
  const rng = random(seed),
    pick = (a) => a[Math.floor(rng() * a.length)];
  const scenario = pick([
    {
      item: "cereal boxes",
      population: "all cereal boxes produced by this line today",
      unit: "pounds",
      base: 1.02,
      spread: 0.1,
    },
    {
      item: "customer orders",
      population: "all customer orders processed by this warehouse this month",
      unit: "minutes",
      base: 42,
      spread: 8,
    },
    {
      item: "reusable bottles",
      population: "all reusable bottles in this production batch",
      unit: "milliliters",
      base: 502,
      spread: 12,
    },
    {
      item: "service visits",
      population: "all service visits at this location this quarter",
      unit: "minutes",
      base: 28,
      spread: 6,
    },
  ]);
  const n = pick([16, 25, 36, 49, 64]),
    mean = Number((scenario.base + (rng() - 0.5) * scenario.spread).toFixed(2)),
    sd = Number((scenario.spread * (0.8 + rng() * 0.4)).toFixed(2)),
    confidence = pick([0.9, 0.95, 0.99]);
  return {
    seed,
    ...scenario,
    n,
    mean,
    sd,
    confidence,
    ...interval({ n, mean, sd, confidence }),
  };
}
const choice = (
  id,
  phase,
  title,
  prompt,
  options,
  correct,
  feedback,
  hints,
  worked,
  link,
) => ({
  id,
  phase,
  title,
  prompt,
  kind: "choice",
  options,
  correct,
  feedback,
  hints,
  worked,
  link,
});
const numeric = (id, phase, title, prompt, fields, hints, worked, link) => ({
  id,
  phase,
  title,
  prompt,
  kind: "numeric",
  fields,
  hints,
  worked,
  link,
});
function steps(p) {
  const level = Math.round(p.confidence * 100),
    unit = p.unit;
  return [
    choice(
      "population",
      "Identify",
      "Who are we trying to learn about?",
      "Which group is the population in this investigation?",
      [
        p.population,
        `Only the ${p.n} sampled ${p.item}`,
        "Every possible sample mean",
      ],
      0,
      [
        `Yes. The population is ${p.population}.`,
        "Those observed items form the sample. Which larger group do we want to describe?",
        "A distribution of sample means describes repeated sampling; it is not the group of items being studied.",
      ],
      [
        "Look for the group named in the research goal.",
        "The sample is a subset of a larger population.",
      ],
      `The population is ${p.population}; the sample is the ${p.n} randomly selected ${p.item}.`,
    ),
    numeric(
      "sample",
      "Identify",
      "Separate count from measurement",
      "Enter the sample size and sample mean. Use the values in the scenario; no calculation is needed.",
      [
        {
          key: "n",
          label: "Sample size n (items)",
          value: p.n,
          decimals: 0,
          integer: true,
        },
        {
          key: "mean",
          label: `Sample mean x̄ (${unit})`,
          value: p.mean,
          decimals: 2,
        },
      ],
      [
        "One value counts items; the other averages measurements.",
        "n counts the sampled items. x̄ is the observed average.",
      ],
      `n = ${p.n} items and x̄ = ${p.mean.toFixed(2)} ${unit}. Neither is the unknown population mean.`,
    ),
    choice(
      "parameter",
      "Identify",
      "What is still unknown?",
      "Which quantity will our interval estimate?",
      [
        "The mean μ of the entire population",
        "The mean x̄ of this sample",
        "The measurement of a single future item",
      ],
      0,
      [
        "Yes. μ is fixed but unknown; x̄ is already observed.",
        "We already know x̄. What mean belongs to the larger group?",
        "Predicting an individual measurement is a different task; individuals vary more than sample averages.",
      ],
      [
        "Separate an observed statistic from an unknown parameter.",
        "The Greek letter μ denotes the population mean.",
      ],
      `We use the observed x̄ = ${p.mean.toFixed(2)} to estimate the unknown population mean μ.`,
    ),
    choice(
      "conditions",
      "Check",
      "Is this method justified?",
      "Our sample was random, observations are independent, and measurements are roughly symmetric with no extreme outliers. What supports using a one-mean t interval?",
      [
        "Those sampling and distribution conditions, with unknown population SD",
        "The sample mean is close to a nice round number",
        "Every sample of at least 30 automatically works",
      ],
      0,
      [
        "Yes. These conditions support inference about the population mean.",
        "A convenient number says nothing about sampling or distribution shape.",
        "A large n helps with moderate nonnormality, but it does not guarantee independence or remove severe outliers or sampling bias.",
      ],
      [
        "Consider how the observations were selected and how their values are distributed.",
        "With small samples, a roughly normal population is especially important.",
      ],
      "Use quantitative observations from a random or defensible representative process, with independence. When sampling without replacement, a sample no more than about 10% of the population often supports approximate independence. Small samples require a roughly normal population with no serious outliers. Larger samples help with moderate skew, but n ≥ 30 is not a universal guarantee. Here the population is much larger than the sample and the stated conditions support the method.",
      links.design,
    ),
    choice(
      "bias",
      "Check",
      "Can more data repair a bad sample?",
      "Suppose we instead take only the easiest items to reach. Would collecting 400 of those items guarantee a trustworthy interval?",
      [
        "No: a precise estimate can still be biased",
        "Yes: a sufficiently large sample removes bias",
      ],
      0,
      [
        "Exactly. Precision and representative sampling are different issues.",
        "More observations can narrow an interval around a biased estimate. What part of the selection process would still be wrong?",
      ],
      [
        "Think about selection, not just how many observations are collected.",
        "Who or what might be systematically left out?",
      ],
      "A larger convenience sample does not guarantee a representative sample. Improve the sampling process; increasing n alone does not fix selection bias.",
      links.design,
    ),
    choice(
      "method",
      "Calculate",
      "Why use Student t?",
      "The scenario gives the sample SD s, and the population SD σ is unknown. Which method fits?",
      [
        "A one-sample t interval with n − 1 degrees of freedom",
        "Always use z = 1.96",
        "Use the sample SD as the margin of error",
      ],
      0,
      [
        "Yes. Estimating σ using s introduces additional uncertainty, represented by t.",
        "1.96 is the 95% normal critical value. Here σ is unknown, and confidence may not be 95%.",
        "s measures individual variability. The margin also depends on sample size and the critical value.",
      ],
      [
        "Which standard deviation is actually known?",
        "For a one-mean t interval, df = n − 1.",
      ],
      `Use x̄ ± t* × s/√n. Here df = ${p.n} − 1 = ${p.df}. At ${level}% confidence, t* = ${p.t.toFixed(6)}.`,
      links.t,
    ),
    numeric(
      "se",
      "Calculate",
      "How variable is a sample mean?",
      "Calculate the estimated standard error, s/√n. Enter 3 decimal places (or a more precise answer). Keep full precision for later calculations.",
      [
        {
          key: "se",
          label: `Estimated standard error (${unit})`,
          value: p.se,
          decimals: 3,
          misconceptions: [
            {
              value: p.sd,
              message:
                "That is s, the spread of individual observations. Divide s by √n to estimate the spread of sample means.",
            },
            {
              value: p.sd / p.n,
              message:
                "Divide by √n, not n. Averaging reduces spread at a square-root rate.",
            },
          ],
        },
      ],
      [
        "Standard error measures how much sample means tend to vary.",
        "Compute s ÷ √n, not s ÷ n.",
      ],
      `SE = ${p.sd.toFixed(2)} / √${p.n} = ${p.se.toFixed(6)} ${unit}.`,
      links.sampling,
    ),
    numeric(
      "margin",
      "Calculate",
      "Build the margin of error",
      `Use t* = ${p.t.toFixed(6)} and the unrounded standard error. Calculate t* × s/√n to 3 decimal places.`,
      [
        {
          key: "margin",
          label: `Margin of error (${unit})`,
          value: p.margin,
          decimals: 3,
          displayTolerance: p.se * 0.0000005,
        },
      ],
      [
        "The critical value stretches the standard error to obtain the requested coverage.",
        "Multiply t* by s/√n. Do not multiply t* by s alone.",
      ],
      `Margin = ${p.t.toFixed(6)} × (${p.sd.toFixed(2)}/√${p.n}) = ${p.margin.toFixed(6)} ${unit}.`,
    ),
    numeric(
      "bounds",
      "Calculate",
      "Center the interval on the sample mean",
      `Calculate the lower and upper endpoints to 3 decimal places. Use x̄ ± t* × s/√n with t* = ${p.t.toFixed(6)}. Keep full precision until the final endpoints.`,
      [
        {
          key: "lower",
          label: `Lower endpoint (${unit})`,
          value: p.lower,
          decimals: 3,
          displayTolerance: p.se * 0.0000005,
        },
        {
          key: "upper",
          label: `Upper endpoint (${unit})`,
          value: p.upper,
          decimals: 3,
          displayTolerance: p.se * 0.0000005,
        },
      ],
      [
        "Subtract the margin from x̄ for the lower endpoint; add it for the upper.",
        "Both endpoints must be equally far from x̄.",
      ],
      `Lower = ${p.mean.toFixed(2)} − ${p.margin.toFixed(6)} = ${f(p.lower)}. Upper = ${p.mean.toFixed(2)} + ${p.margin.toFixed(6)} = ${f(p.upper)} ${unit}.`,
    ),
    choice(
      "interpret",
      "Interpret",
      "Say what the interval means",
      `Which interpretation fits the ${level}% confidence interval [${f(p.lower)}, ${f(p.upper)}] ${unit}?`,
      [
        `We are ${level}% confident that the population mean lies between these endpoints`,
        `${level}% of individual ${p.item} have measurements inside these endpoints`,
        `${level}% of sample observations lie inside these endpoints`,
      ],
      0,
      [
        "Yes. This interval estimates a population mean; confidence describes the reliability of the procedure.",
        "This is an interval for a mean, not a range containing most individual measurements. How would an individual value differ from an average?",
        "The interval does not describe the fraction of observed items inside it. It estimates the population mean.",
      ],
      [
        "Identify the quantity being estimated.",
        "Use “population mean,” not “individual measurements.”",
      ],
      `We are ${level}% confident that the mean measurement for ${p.population} is between ${f(p.lower)} and ${f(p.upper)} ${unit}. This confidence refers to the method’s long-run coverage.`,
      links.inference,
    ),
    choice(
      "coverage",
      "Interpret",
      "Where does the confidence live?",
      `After this interval has been calculated, what does ${level}% confidence describe?`,
      [
        `About ${level}% of intervals from repeated independent samples would contain the fixed μ`,
        `There is a ${level}% probability that the fixed μ is inside this particular realized interval`,
        `Exactly ${level} of every 100 intervals must contain μ`,
      ],
      0,
      [
        "Yes. The parameter stays fixed; the sample and its interval vary.",
        "For a fixed population mean, this realized interval either contains μ or it does not. The confidence percentage belongs to the sampling procedure.",
        "Long-run coverage is not a promise about the exact count in a finite batch. Random batches vary.",
      ],
      [
        "Imagine repeating the sampling procedure many times.",
        "The intervals move from sample to sample; the population mean stays fixed.",
      ],
      `Under the model assumptions, about ${level}% of intervals made by this procedure would cover μ over many repetitions. A particular interval either covers it or does not. Explore this in the Repeated samples tab.`,
    ),
    choice(
      "width",
      "Explore",
      "Predict before you experiment",
      "Holding the sample mean, sample SD, and confidence level fixed, what happens when n increases from 25 to 100?",
      [
        "The interval becomes narrower; its width is a little less than half",
        "The width stays the same",
        "The interval becomes wider",
      ],
      0,
      [
        "Yes. √n doubles, and the t critical value decreases slightly as df increases.",
        "SE = s/√n decreases as n grows. What does that do to the margin?",
        "More independent observations generally improve precision when the other inputs are held fixed.",
      ],
      [
        "Compare √25 and √100.",
        "The t critical value also changes because df = n − 1.",
      ],
      "With s and confidence fixed, quadrupling n approximately halves width; for t intervals it is slightly less than half because t* also decreases. Doubling n does not halve width. Try the Width lab tab.",
      links.sampling,
    ),
  ];
}
export const topics = [
  {
    id: "one-mean-ci",
    label: "One population mean · CI",
    available: true,
    makeProblem,
    steps,
  },
];
export const futureTopics = [
  "One-proportion confidence intervals",
  "One-sample hypothesis tests",
  "Comparing two groups",
  "Regression and correlation",
  "Categorical inference",
  "One-way ANOVA",
  "Sampling distributions",
  "Choosing an inference method",
];
