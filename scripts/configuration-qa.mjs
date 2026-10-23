// Explicit, reversible development-theme configuration exercise. Never targets a live theme.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { open, privacy } from "../tests/browser/helpers.mjs";
const exec = promisify(execFile);
const cli =
  process.env.SHOPIFY_CLI_ENTRY ||
  join(process.env.APPDATA, "npm/node_modules/@shopify/cli/bin/run.js");
const theme =
  process.env.SHOPIFY_THEME_ID ||
  JSON.parse(await readFile(".local/preflight/resource-ledger.json", "utf8"))
    .themes.preflightUnpublished;
const args = [
  "--store",
  "brewbench-practice.myshopify.com",
  "--theme",
  String(theme),
  "--path",
  resolve("theme"),
  "--json",
];
const listing = JSON.parse(
  (
    await exec(
      process.execPath,
      [
        cli,
        "theme",
        "list",
        "--store",
        "brewbench-practice.myshopify.com",
        "--json",
      ],
      { windowsHide: true },
    )
  ).stdout,
);
if (
  !listing.some(
    (t) => String(t.id) === String(theme) && t.role === "unpublished",
  )
)
  throw new Error(
    "Configuration QA requires the private unpublished candidate theme.",
  );
const settingsPath = "theme/config/settings_data.json";
const original = await readFile(settingsPath, "utf8");
const product = JSON.parse(
  await readFile("theme/templates/product.json", "utf8"),
);
product.sections.guide_duplicate = structuredClone(product.sections.guide);
product.order.push("guide_duplicate");
product.sections.faq_duplicate = structuredClone(product.sections.faq);
product.order.push("faq_duplicate");
const home = {
  sections: {
    hero: { type: "bb-hero", settings: { use_original_image: false } },
    methods: {
      type: "bb-methods",
      blocks: {
        empty: {
          type: "method",
          settings: { title: "Missing-image QA example" },
        },
      },
      block_order: ["empty"],
      settings: {},
    },
  },
  order: ["hero", "methods"],
};
const paths = [
  "theme/templates/product.qa.json",
  "theme/templates/index.qa.json",
];
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: "https://brewbench-practice.myshopify.com",
  storageState: ".local/playwright/auth.json",
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: ".local/configuration/video" },
});
const page = await context.newPage();
async function push(extra = []) {
  const r = await exec(
    process.execPath,
    [cli, "theme", "push", ...args, ...extra],
    { windowsHide: true, maxBuffer: 5e6, timeout: 120000 },
  );
  if (/"errors"\s*:/.test(r.stdout))
    throw new Error("Theme push reported errors");
}
try {
  const settings = JSON.parse(original);
  settings.current.bb_experiment_enabled = false;
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  await writeFile(paths[0], JSON.stringify(product, null, 2));
  await writeFile(paths[1], JSON.stringify(home, null, 2));
  await push([
    "--only",
    "templates/product.qa.json",
    "--only",
    "templates/index.qa.json",
    "--only",
    "config/settings_data.json",
  ]);
  await open(page, "/products/cone-brewer?view=qa&bb_group=treatment");
  await privacy(page, "accept");
  await expect(page.locator(".bb-guide")).toHaveCount(2);
  await expect(page.locator(".bb-faq")).toHaveCount(2);
  const ids = await page
    .locator(".bb-guide h2,.bb-faq h2")
    .evaluateAll((elements) => elements.map((e) => e.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(await page.evaluate(() => window.BrewbenchQA.status().group)).toBe(
    "standard",
  );
  expect(
    await page.evaluate(() =>
      window.BrewbenchQA.exportEvents().filter(
        (e) => e.name === "experiment_exposure",
      ),
    ),
  ).toHaveLength(0);
  await page.screenshot({ path: "docs/evidence/kill-switch.png" });
  await open(page, "/?view=qa");
  await expect(page.locator(".bb-hero__empty")).toBeVisible();
  await expect(page.locator(".bb-placeholder")).toBeVisible();
  await page.screenshot({ path: "docs/evidence/missing-image-fallback.png" });
  await writeFile(
    "docs/evidence/configuration.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        duplicateGuides: 2,
        duplicateFAQs: 2,
        headingIDsUnique: true,
        killSwitch:
          "standard experience, zero exposures despite treatment override",
        missingHero: "text fallback",
        missingMethodPhoto: "placeholder",
        editorUsed: false,
      },
      null,
      2,
    ),
  );
} finally {
  await writeFile(settingsPath, original);
  for (const path of paths)
    await unlink(path).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  await push(); // Full synchronization removes the two temporary remote templates.
  await context.close();
  await browser.close();
}
console.log(
  "Duplicate sections, missing-media fallbacks and kill switch verified; original theme restored.",
);
