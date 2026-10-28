import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import { createSession } from "../modules/statistics-tutor/engine.mjs";
import { topics } from "../modules/statistics-tutor/topics.mjs";
import { writeFile, mkdir } from "node:fs/promises";
const url =
  process.env.TUTOR_URL || "http://127.0.0.1:4174/modules/statistics-tutor/";
const out = process.env.TUTOR_QA_DIR || "/tmp/tutor-qa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
});
const reports = [];
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) =>
      requests.push({ url: r.url(), method: r.method() }),
    );
    await page.goto(url);
    await page.locator("#topic option").waitFor({ state: "attached" });
    assert.equal(
      await page.locator("#topic option:not([disabled])").count(),
      1,
    );
    await page.screenshot({
      path: `${out}/initial-${viewport.width}.png`,
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    // Keyboard: skip link, native select and a choice can be operated without a mouse.
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent.trim()),
      "Skip to activity",
    );
    await page.keyboard.press("Enter");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "activity",
    );
    await page.locator("#topic").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await page.locator('input[type="radio"]').first().focus();
    await page.keyboard.press("Space");
    assert.equal(await page.locator('input:checked').count(), 1);
    await page.locator('#check').focus();
    await page.keyboard.press("Enter");
    assert((await page.locator('#feedback').textContent()).length > 0);
    await page.locator('#reset').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator('input:checked').count(), 0);
    const session = createSession(topics[0], 1025);
    for (let i = 0; i < session.steps.length; i++) {
      const step = session.steps[i];
      assert.equal(
        await page.locator("#question-title").textContent(),
        step.title,
      );
      await page.locator("#check").click();
      assert.match(
        await page.locator("#feedback").textContent(),
        /Choose|valid number/,
      );
      if (step.kind === "choice") {
        const wrong = step.options.findIndex((_, j) => j !== step.correct);
        await page.locator(`input[name=choice][value="${wrong}"]`).check();
        await page.locator("#check").click();
        assert.match(
          await page.locator("#feedback").textContent(),
          /think again/,
        );
        assert(await page.locator("#next").isDisabled());
      } else {
        for (const field of step.fields)
          await page.locator(`[name="${field.key}"]`).fill("10abc");
        await page.locator("#check").click();
        assert(
          (await page.locator("#answer-fields [aria-invalid=true]").count()) >
            0,
        );
        for (const field of step.fields)
          await page.locator(`[name="${field.key}"]`).fill("");
      }
      await page.locator("#hint").click();
      await page.locator("#hint").click();
      assert(await page.locator("#hint").isDisabled());
      assert.equal(await page.locator("#hint-content p").count(), 2);
      if (i === 3) {
        await page.locator("#worked").click();
        assert.match(await page.locator("#hint-content").textContent(), /10%/);
      }
      if (step.kind === "choice")
        await page
          .locator(`input[name=choice][value="${step.correct}"]`)
          .check();
      else
        for (const field of step.fields)
          await page
            .locator(`[name="${field.key}"]`)
            .fill(field.value.toFixed(field.decimals));
      await page.locator("#check").click();
      assert.match(await page.locator("#feedback").textContent(), /^Correct/);
      assert(!(await page.locator("#next").isDisabled()));
      await page.locator("#check").click();
      assert.equal(
        await page.locator("#progress").getAttribute("value"),
        String(i + 1),
      );
      if (step.link) {
        const a = page.locator("#companion a");
        assert.equal(await a.getAttribute("target"), "_blank");
        assert.equal(await a.getAttribute("href"), step.link.href);
        assert(!new URL(await a.getAttribute("href")).search);
      }
      if (i === 6) {
        await page.screenshot({
          path: `${out}/calculation-${viewport.width}.png`,
          fullPage: true,
        });
        await page.locator("#previous").click();
        await page.locator("#next").click();
        assert.equal(
          await page.locator("[name=se]").inputValue(),
          step.fields[0].value.toFixed(3),
        );
      }
      await page.locator("#next").click();
    }
    assert.match(
      await page.locator("#complete").textContent(),
      /answered 12 questions correctly/,
    );
    await page.screenshot({
      path: `${out}/complete-${viewport.width}.png`,
      fullPage: true,
    });
    await page.locator("#complete-fresh").click();
    assert.equal(
      await page.locator("#problem-id").textContent(),
      "Problem 1026",
    );
    assert.equal(await page.locator("input:checked").count(), 0);
    assert.equal(await page.locator("#hint-content").textContent(), "");
    assert.equal(await page.locator("#progress").getAttribute("value"), "0");
    await page.locator("input[type=radio]").first().check();
    await page.locator("#reset").click();
    assert.equal(await page.locator("input:checked").count(), 0);
    await page.locator("#worked").click();
    await page.locator("#next").click();
    await page.locator("[name=n]").fill("25");
    await page.locator("#fresh").click();
    assert.equal(await page.locator("input:checked").count(), 0);
    assert.equal(
      await page.locator("#problem-id").textContent(),
      "Problem 1027",
    );
    // View changes preserve typed answers; clear/reset controls affect only their own lab.
    await page.locator("input[type=radio]").first().check();
    const chosen = await page.locator("input:checked").getAttribute("value");
    await page.locator("[data-view=width]").click();
    const before = await page.locator("#width-result").textContent();
    await page.locator("#width-n").fill("100");
    await page.locator("#width-n").dispatchEvent("input");
    assert.notEqual(await page.locator("#width-result").textContent(), before);
    await page.locator("#width-sd").fill("20");
    await page.locator("#width-sd").dispatchEvent("input");
    await page.locator("#width-confidence").selectOption("0.99");
    await page.screenshot({
      path: `${out}/width-${viewport.width}.png`,
      fullPage: true,
    });
    await page.locator("#width-reset").click();
    assert.equal(await page.locator("#width-result").textContent(), before);
    await page.locator("[data-view=sampling]").click();
    await page.locator("#sample-one").click();
    assert.match(
      await page.locator("#simulation-summary").textContent(),
      /of 1 intervals/,
    );
    await page.locator("#sample-hundred").click();
    assert.match(
      await page.locator("#simulation-summary").textContent(),
      /of 101 intervals/,
    );
    assert.equal(await page.locator("#samples-table tr").count(), 30);
    await page.screenshot({
      path: `${out}/sampling-${viewport.width}.png`,
      fullPage: true,
    });
    await page.locator("#sim-n").selectOption("100");
    assert.match(
      await page.locator("#simulation-summary").textContent(),
      /No samples/,
    );
    await page.locator("#sample-hundred").click();
    await page.locator("#sim-reset").click();
    assert.equal(await page.locator("#samples-table tr").count(), 0);
    await page.locator("[data-view=guided]").click();
    assert.equal(
      await page.locator("input:checked").getAttribute("value"),
      chosen,
    );
    await page.reload();
    assert.equal(
      await page.locator("#problem-id").textContent(),
      "Problem 1025",
    );
    assert.equal(await page.locator("input:checked").count(), 0);
    assert.equal(await page.locator("#progress").getAttribute("value"), "0");
    assert.deepEqual(
      await page.evaluate(() => ({
        local: localStorage.length,
        session: sessionStorage.length,
        cookies: document.cookie,
      })),
      { local: 0, session: 0, cookies: "" },
    );
    assert.deepEqual(errors, []);
    assert(
      requests.every(
        (r) => r.url.startsWith(new URL(url).origin) && r.method === "GET",
      ),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    reports.push({
      viewport,
      fullLesson: true,
      hints: true,
      misconceptions: true,
      numericValidation: true,
      repeatedAnswers: true,
      backForward: true,
      resetFresh: true,
      topicDropdown: true,
      viewState: true,
      widthLab: true,
      simulation: true,
      keyboard: true,
      noRetainedData: true,
      noExternalRequests: true,
      errors,
    });
    await context.close();
  }
  await writeFile(
    `${out}/browser-results.json`,
    JSON.stringify({ browser: await browser.version(), url, reports }, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
