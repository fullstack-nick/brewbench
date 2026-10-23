import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const phase = process.argv[2];
if (!["before", "after"].includes(phase))
  throw new Error("Use before or after");
const base =
  process.env.SHOPIFY_BASE_URL || "https://brewbench-practice.myshopify.com";
const theme = process.env.SHOPIFY_THEME_ID;
if (!theme)
  throw new Error("Set SHOPIFY_THEME_ID to the unpublished candidate theme.");
const folder = join(".local/performance", phase);
await mkdir(folder, { recursive: true });
const state = JSON.parse(await readFile(".local/playwright/auth.json", "utf8"));
const context = await chromium.launchPersistentContext(
  ".local/performance/browser",
  {
    headless: true,
    args: ["--remote-debugging-port=9222"],
    viewport: { width: 390, height: 844 },
  },
);
await context.addCookies(state.cookies);
const page = await context.newPage();
let summary = {
  phase,
  at: new Date().toISOString(),
  engine: "Chromium bundled with Playwright 1.64.1",
  profile:
    "Lighthouse mobile simulation; 1.6 Mbps, 150 ms RTT, CPU slowdown 4x; cache cleared per run; authenticated preview; no Lighthouse storage reset",
  runs: [],
};
if (process.argv.includes("--resume"))
  summary = JSON.parse(await readFile(join(folder, "checkpoint.json"), "utf8"));
const paths = {
  home: "/",
  collection: "/collections/brewers",
  product: "/products/cone-brewer",
};
try {
  for (const [name, path] of Object.entries(paths))
    for (let run = 1; run <= 3; run++) {
      if (summary.runs.some((r) => r.page === name && r.run === run)) continue;
      const url = new URL(path, base);
      url.searchParams.set("preview_theme_id", theme);
      url.searchParams.set("pb", "0");
      const response = await page.goto(url.href, {
        waitUntil: "domcontentloaded",
      });
      if (
        response.status() >= 400 ||
        new URL(page.url()).pathname === "/password" ||
        !(await page.locator("#MainContent").count())
      )
        throw new Error(
          `Storefront unavailable for ${name}; HTTP ${response.status()}. No measurement accepted.`,
        );
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.clearBrowserCache");
      await cdp.detach();
      const result = await lighthouse(url.href, {
        port: 9222,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance"],
        disableStorageReset: true,
      });
      const lhr = result.lhr;
      if (
        lhr.runtimeError ||
        !lhr.finalDisplayedUrl.includes(path) ||
        lhr.finalDisplayedUrl.includes("/password") ||
        lhr.audits["http-status-code"]?.score === 0
      )
        throw new Error(
          "Lighthouse did not measure the authenticated storefront.",
        );
      await writeFile(join(folder, `${name}-${run}.json`), result.report);
      const audit = (id) => lhr.audits[id]?.numericValue;
      summary.runs.push({
        page: name,
        run,
        score: lhr.categories.performance.score,
        LCP_ms: audit("largest-contentful-paint"),
        FCP_ms: audit("first-contentful-paint"),
        TBT_ms: audit("total-blocking-time"),
        CLS: audit("cumulative-layout-shift"),
        bytes: audit("total-byte-weight"),
      });
      console.log(JSON.stringify(summary.runs.at(-1)));
      await writeFile(
        join(folder, "checkpoint.json"),
        JSON.stringify(summary, null, 2),
      );
    }
  const median = (values) =>
    values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
  summary.medians = Object.fromEntries(
    Object.keys(paths).map((name) => [
      name,
      Object.fromEntries(
        ["score", "LCP_ms", "FCP_ms", "TBT_ms", "CLS", "bytes"].map((key) => [
          key,
          median(
            summary.runs.filter((r) => r.page === name).map((r) => r[key]),
          ),
        ]),
      ),
    ]),
  );
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    `docs/evidence/performance-${phase}.json`,
    JSON.stringify(summary, null, 2) + "\n",
  );
} finally {
  await context.close();
}
