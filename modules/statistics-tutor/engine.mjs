import { closeEnough, numberFrom, random } from "./math.mjs";
export function createSession(topic, seed) {
  const problem = topic.makeProblem(seed),
    steps = topic.steps(problem),
    rng = random(seed + 91);
  return {
    topic: topic.id,
    problem,
    steps,
    index: 0,
    states: steps.map((step) => {
      const order = step.options?.map((_, i) => i) ?? [];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return {
        answers: {},
        order,
        hints: 0,
        attempts: 0,
        resolved: false,
        correct: false,
        reviewed: false,
        feedback: "",
        tone: "",
        fields: {},
      };
    }),
  };
}
export function grade(step, answers) {
  if (step.kind === "choice") {
    const raw = answers.choice;
    if (
      raw === undefined ||
      raw === "" ||
      !Number.isInteger(Number(raw)) ||
      !step.options[Number(raw)]
    )
      return {
        correct: false,
        feedback: "Choose an answer first, then check your reasoning.",
        fields: {},
        valid: false,
      };
    const selected = Number(raw),
      correct = selected === step.correct;
    return {
      correct,
      feedback:
        (correct ? "Correct. " : "Let’s think again. ") +
        step.feedback[selected],
      fields: {},
      valid: true,
    };
  }
  const fields = {};
  let correct = true,
    valid = true;
  for (const field of step.fields) {
    const value = numberFrom(answers[field.key]);
    if (
      !Number.isFinite(value) ||
      (field.integer && !Number.isInteger(value))
    ) {
      fields[field.key] = {
        correct: false,
        message: field.integer
          ? "Enter a whole number."
          : "Enter a number only (no units or other text).",
      };
      correct = false;
      valid = false;
      continue;
    }
    const ok = field.integer
      ? value === field.value
      : closeEnough(
          value,
          field.value,
          field.decimals,
          field.displayTolerance ?? 0,
        );
    const misconception = field.misconceptions?.find((m) =>
      closeEnough(value, m.value, field.decimals),
    );
    fields[field.key] = {
      correct: ok,
      message: ok
        ? "Correct. This part checks out."
        : (misconception?.message ??
          `Not quite. Recheck this part and round to ${field.decimals} decimal places. A hint is available.`),
    };
    correct &&= ok;
  }
  return {
    correct,
    fields,
    valid,
    feedback: correct
      ? "Correct. Each part checks out. You can continue or review the explanation."
      : valid
        ? "Recheck the marked part" +
          (step.fields.length > 1 ? "s" : "") +
          ". Correct parts are kept."
        : "Enter a valid number in each marked field; blanks and text are not treated as zero.",
  };
}
