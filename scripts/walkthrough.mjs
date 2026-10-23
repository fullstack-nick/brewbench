import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const exec = promisify(execFile);
await mkdir(".local/walkthrough", { recursive: true });
const before = JSON.parse(
  await readFile("docs/evidence/performance-before.json", "utf8"),
);
const after = JSON.parse(
  await readFile("docs/evidence/performance-after.json", "utf8"),
);
const rows = Object.keys(before.medians)
  .map((k) => {
    const b = before.medians[k],
      a = after.medians[k];
    return `<tr><th>${k}</th><td>${(b.LCP_ms / 1000).toFixed(2)} → ${(a.LCP_ms / 1000).toFixed(2)} s</td><td>${Math.round(b.bytes / 1000)} → ${Math.round(a.bytes / 1000)} kB</td><td>${Math.round(b.TBT_ms)} → ${Math.round(a.TBT_ms)} ms</td></tr>`;
  })
  .join("");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Brewbench — measured optimization</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f5ee;color:#292d25;font:20px/1.5 Arial;padding:60px 70px}small{font-size:15px;text-transform:uppercase;letter-spacing:.12em;color:#445542}h1{font:54px/1.1 Georgia;margin:20px 0}p{max-width:1000px}table{width:100%;border-collapse:collapse;background:#fffaf1;margin:30px 0}th,td{text-align:left;padding:18px;border-bottom:1px solid #d7d8ce}thead{background:#dce3d4;font-size:17px}aside{background:#e9dfc8;padding:20px}footer{font-size:16px;margin-top:25px;color:#606759}</style><small>Brewbench · local lab evidence · 23 October 2026</small><h1>Less to download.<br>Timing still needs care.</h1><p>Responsive hero images, one variable-font request and an optional account widget disabled for guest checkout.</p><table><thead><tr><th>Route</th><th>Median LCP</th><th>Transferred</th><th>Blocking time</th></tr></thead><tbody>${rows}</tbody></table><aside>All routes transfer fewer bytes. Home/product LCP improved in this sample. TBT increased versus baseline. Three runs per route; variable local conditions. No field-performance or real conversion-lift claim.</aside><footer>Sources: performance-before.json and performance-after.json. The full report retains intermediate results, outliers and measurement limitations.</footer></html>`;
await writeFile("docs/evidence/performance-summary.html", html);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: {
    dir: ".local/walkthrough/metrics",
    size: { width: 1280, height: 900 },
  },
});
const page = await context.newPage();
await page.goto(
  pathToFileURL(resolve("docs/evidence/performance-summary.html")).href,
);
await page.screenshot({ path: "docs/evidence/performance-summary.png" });
await page.waitForTimeout(9000);
const video = page.video();
await context.close();
await video.saveAs(".local/walkthrough/metrics.webm");
await browser.close();
const clips = ["customer", "engineering", "metrics"];
let elapsed = 0;
const chapters = [];
for (const [i, clip] of clips.entries()) {
  const input = `.local/walkthrough/${clip}.webm`,
    output = `.local/walkthrough/${clip}.mp4`;
  const inputDuration = Number(
    (
      await exec(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          input,
        ],
        { windowsHide: true },
      )
    ).stdout.trim(),
  );
  const filters =
    "scale=1280:900:force_original_aspect_ratio=decrease,pad=1280:900:(ow-iw)/2:(oh-ih)/2:color=0xf7f5ee,fps=25" +
    (clip === "customer"
      ? `,drawbox=x=208:y=106:w=180:h=22:color=white:t=fill:enable='gte(t,${Math.max(0, inputDuration - 4)})'`
      : "");
  await exec(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-vf",
      filters,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-an",
      output,
    ],
    { windowsHide: true, maxBuffer: 2e6, timeout: 120000 },
  );
  const duration = Number(
    (
      await exec(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          output,
        ],
        { windowsHide: true },
      )
    ).stdout.trim(),
  );
  chapters.push({
    chapter: i + 1,
    title: [
      "Customer journey, country/language switch and test checkout",
      "Intentional wrong-variant defect, correction and shared guide edit",
      "Measured optimization and its limits",
    ][i],
    startSeconds: elapsed,
    durationSeconds: duration,
  });
  elapsed += duration;
}
await writeFile(
  ".local/walkthrough/concat.txt",
  clips.map((c) => `file '${c}.mp4'`).join("\n"),
);
await exec(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    ".local/walkthrough/concat.txt",
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "docs/evidence/brewbench-walkthrough.mp4",
  ],
  { windowsHide: true, maxBuffer: 2e6, timeout: 120000 },
);
await writeFile(
  "docs/evidence/walkthrough-chapters.json",
  JSON.stringify(
    {
      durationSeconds: elapsed,
      chapters,
      note: "Actual storefront recordings plus a clearly labeled local measurement report. The theme defect is intentionally injected in the test browser; shared content is restored. No password or authentication screens are recorded. The final checkout confirmation reference is redacted.",
    },
    null,
    2,
  ),
);
console.log(`Built ${Math.round(elapsed)} second walkthrough.`);
