import { readFile, writeFile } from "node:fs/promises";
const r = JSON.parse(await readFile(".local/playwright/report.json", "utf8"));
const tests = [];
function visit(s) {
  for (const spec of s.specs || [])
    for (const t of spec.tests)
      tests.push({
        title: spec.title,
        project: t.projectName,
        status: t.results.at(-1)?.status,
        durationMs: t.results.at(-1)?.duration,
      });
  for (const child of s.suites || []) visit(child);
}
visit(r);
if (
  r.stats.unexpected ||
  r.stats.flaky ||
  tests.some((t) => t.status !== "passed")
)
  throw new Error("Final browser suite is not fully green");
await writeFile(
  "docs/evidence/browser-results.json",
  JSON.stringify(
    {
      at: r.stats.startTime,
      total: tests.length,
      passed: r.stats.expected,
      failed: r.stats.unexpected,
      skipped: r.stats.skipped,
      flaky: r.stats.flaky,
      durationMs: r.stats.duration,
      tests,
    },
    null,
    2,
  ),
);
console.log(
  `Exported ${tests.length} passing browser checks without raw session data.`,
);
