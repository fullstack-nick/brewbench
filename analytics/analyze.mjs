import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { deduplicate, EXPERIMENT } from "../theme/assets/bb-core.js";
export function sampleSize(baseline = 0.16, relativeEffect = 0.15) {
  const p1 = baseline,
    p2 = baseline * (1 + relativeEffect),
    pooled = (p1 + p2) / 2;
  return Math.ceil(
    (1.96 * Math.sqrt(2 * pooled * (1 - pooled)) +
      0.8416 * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) **
      2 /
      (p2 - p1) ** 2,
  );
}
export function wilson(success, total) {
  if (!total) return [0, 0];
  const z = 1.96,
    p = success / total,
    d = 1 + (z * z) / total,
    c = (p + (z * z) / (2 * total)) / d,
    h =
      (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
      d;
  return [c - h, c + h];
}
const percentile = (values, p) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
    : null;
export function analyze(raw) {
  const unique = deduplicate(raw);
  const eligible = unique.filter(
    (e) =>
      e.consent === true &&
      !e.test_traffic &&
      e.eligible &&
      e.experiment === EXPERIMENT &&
      e.release === "1.0.0" &&
      ["control", "treatment"].includes(e.group),
  );
  const visitors = new Map();
  const conflicts = new Set();
  for (const e of eligible.filter((e) => e.name === "experiment_exposure")) {
    const prev = visitors.get(e.visitor);
    if (prev && prev.group !== e.group) conflicts.add(e.visitor);
    else if (!prev || Date.parse(e.timestamp) < Date.parse(prev.timestamp))
      visitors.set(e.visitor, e);
  }
  for (const id of conflicts) visitors.delete(id);
  const missingExposure = new Set(
    eligible
      .filter(
        (e) => e.name !== "experiment_exposure" && !visitors.has(e.visitor),
      )
      .map((e) => e.visitor),
  );
  const events = eligible.filter((e) => {
    const exposure = visitors.get(e.visitor);
    return (
      exposure &&
      e.group === exposure.group &&
      Date.parse(e.timestamp) >= Date.parse(exposure.timestamp) &&
      Date.parse(e.timestamp) - Date.parse(exposure.timestamp) <= 7 * 86400000
    );
  });
  function cohort(predicate) {
    const exposed = [...visitors.values()].filter(predicate),
      ids = new Set(exposed.map((e) => e.visitor));
    const rows = events.filter((e) => ids.has(e.visitor));
    const count = (name) =>
      new Set(
        rows
          .filter(
            (e) =>
              e.name === name &&
              (name !== "add_to_cart" ||
                e.product_id === visitors.get(e.visitor).product_id),
          )
          .map((e) => e.visitor),
      ).size;
    const added = count("add_to_cart");
    return {
      exposed: ids.size,
      added,
      rate: ids.size ? added / ids.size : 0,
      interval: wilson(added, ids.size),
      attached: count("compatible_add"),
      purchased: count("purchase"),
      errors: count("interaction_error"),
      latencyP75: percentile(
        rows
          .filter((e) => e.name === "interaction_timing")
          .map((e) => e.latency_ms),
        0.75,
      ),
      clsP75: percentile(
        rows.filter((e) => e.name === "interaction_timing").map((e) => e.cls),
        0.75,
      ),
    };
  }
  const groups = Object.fromEntries(
    ["control", "treatment"].map((group) => [
      group,
      cohort((e) => e.group === group),
    ]),
  );
  const total = groups.control.exposed + groups.treatment.exposed,
    expected = total / 2;
  const srmChiSquare = expected
    ? ((groups.control.exposed - expected) ** 2 +
        (groups.treatment.exposed - expected) ** 2) /
      expected
    : 0;
  const segments = Object.fromEntries(
    ["AT", "DE", "GB"].flatMap((country) =>
      ["desktop", "mobile"].map((device) => [
        `${country}/${device}`,
        Object.fromEntries(
          ["control", "treatment"].map((group) => [
            group,
            cohort(
              (e) =>
                e.country === country &&
                e.device === device &&
                e.group === group,
            ),
          ]),
        ),
      ]),
    ),
  );
  return {
    source: "deterministic synthetic data only",
    rawEvents: raw.length,
    duplicatesRemoved: raw.length - unique.length,
    excludedEvents: unique.length - eligible.length,
    missingExposureVisitors: missingExposure.size,
    assignmentConflicts: conflicts.size,
    groups,
    segments,
    srmChiSquare,
    srmAlert: srmChiSquare > 10.828,
    samplePerArm: sampleSize(),
  };
}
export async function writeReport() {
  const raw = (await readFile("analytics/data/synthetic-events.jsonl", "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  const report = analyze(raw);
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/synthetic-analysis.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  const pct = (n) => (n * 100).toFixed(2) + "%";
  const row = (label, g) =>
    `| ${label} | ${g.exposed} | ${g.added} | ${pct(g.rate)} | ${g.interval.map(pct).join("–")} | ${g.attached} | ${g.purchased} | ${g.errors} | ${g.latencyP75} |`;
  const text = `# Synthetic experiment analysis\n\n**Every row is generated, not observed shopper behavior. No conversion lift is claimed.**\n\nReproduce with \`node analytics/generate.mjs\` then \`npm run analytics:report\`. Seed: 20261023. Exposure is the denominator; assignment alone never counts. Successful brewer additions are unique exposed visitors adding the viewed product within seven days after exposure. Compatible additions and purchases are secondary visitor counts.\n\n${report.rawEvents} raw events; ${report.duplicatesRemoved} duplicates removed; ${report.excludedEvents} events excluded for consent, QA traffic or context; ${report.missingExposureVisitors} visitors lacked exposure; ${report.assignmentConflicts} assignment conflicts. Missing exposures are excluded, not imputed. Missing purchases understate conversion and cannot be reconstructed from these events.\n\n| Group | Exposed | Brewer added | Add rate | 95% Wilson interval | Filter attached | Purchased | Errors | p75 latency ms |\n|---|---:|---:|---:|---|---:|---:|---:|---:|\n${Object.entries(
    report.groups,
  )
    .map(([k, v]) => row(k, v))
    .join(
      "\n",
    )}\n\n## Market and device diagnosis\n\n| Segment / group | Exposed | Brewer added | Add rate | 95% interval | Filter attached | Purchased | Errors | p75 latency ms |\n|---|---:|---:|---:|---|---:|---:|---:|---:|\n${Object.entries(
    report.segments,
  )
    .flatMap(([s, groups]) =>
      Object.entries(groups).map(([g, v]) => row(s + " / " + g, v)),
    )
    .join(
      "\n",
    )}\n\nThe generator intentionally lowers the treatment's UK-mobile add probability and increases its latency, errors and layout shift. Segmenting exposes that anomaly; aggregate results alone conceal the different experience. This is a diagnostic exercise, not evidence about the delivered theme. Pause a real rollout on such a guardrail failure and inspect market-specific requests before interpreting conversion.\n\n## Analysis contract\n\nBaseline 16% brewer-add rate, target 15% relative improvement (18.4%, +2.4 percentage points), two-sided alpha 0.05 and 80% power. The two-independent-proportions normal approximation gives **${report.samplePerArm} exposed visitors per arm**. Formula: [1.96√(2p̄(1−p̄)) + 0.8416√(p₁(1−p₁)+p₂(1−p₂))]² / (p₂−p₁)². This synthetic sample is below that target.\n\nFor a real study: run at least 14 complete days and until both arms reach the target; stop at 28 days as inconclusive if they do not. No early efficacy stopping or repeated significance peeking. Stop immediately for shopping failures/privacy defects; predeclare guardrail review. Segment comparisons are exploratory and not independently powered. A 30-day assignment expiry is fixed for this version.\n\n50:50 sample-ratio chi-square = ${report.srmChiSquare.toFixed(3)} (1 degree of freedom; alert threshold 10.828 at p<0.001): ${report.srmAlert ? "ALERT" : "no alert"}. This check does not establish that instrumentation is complete. Guardrails: error visitors / exposed, p75 interaction latency, p75 CLS, SRM. CLS and latency here are synthetic; real lab evidence is reported separately.\n\n## Evidence boundaries\n\nTheme events prove views, observed exposure and successful Ajax additions. A checkout click is named \`checkout_click\`; it is not \`checkout_started\`. Checkout and purchase customer-event adapters are fixture-tested only. The separate real browser test order demonstrates checkout, not installation of a purchase pixel. No external analytics service receives these data.\n`;
  await writeFile("docs/SYNTHETIC_ANALYSIS.md", text);
  console.log(
    `Synthetic analysis written; target ${report.samplePerArm} visitors per arm.`,
  );
  return report;
}
if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url))
  await writeReport();
