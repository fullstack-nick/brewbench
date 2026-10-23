# Storefront performance

Measured on 23 October 2026 against the authenticated, unpublished Brewbench theme. These are lab observations, not field Core Web Vitals or an experiment on real shoppers.

Three Lighthouse 13.5.0 runs per route before and after. Chromium bundled with Playwright 1.64.1; Lighthouse mobile simulation, 1.6 Mbps, 150 ms RTT, 4× CPU slowdown. Browser cache was cleared for each run. Password authentication was retained, storage reset disabled, preview bar hidden. The harness rejects password/error pages. Raw reports stay private; [before](evidence/performance-before.json), [intermediate](evidence/performance-intermediate.json) and [after](evidence/performance-after.json) contain sanitized observations.

| Route | Median LCP before → after | Median transferred bytes before → after | Median TBT before → after | Median score before → after |
|---|---|---|---|---|
| Home | 4.771 → 3.404 s | 845,078 → 588,284 | 101.5 → 164.5 ms | 77 → 85 |
| Brewers collection | 3.735 → 3.541 s | 629,288 → 514,453 | 170.0 → 282.4 ms | 82 → 85 |
| Cone Brewer | 4.382 → 3.089 s | 650,309 → 512,662 | 119.5 → 179.5 ms | 78 → 87 |

Median CLS was zero before and after on all three routes. Individual runs and their outliers remain in the evidence.

## What changed and why

The baseline served the same oversized editorial image to mobile visitors. The hero now uses 480/750/1100/1536-pixel WebP candidates, explicit dimensions and responsive sizes, with eager/high-priority loading for the actual hero. The original 1536-pixel source is no longer upscaled. A duplicated DM Sans font request was removed by declaring the existing variable font's full weight range.

The first follow-up reduced bytes but showed worse blocking-time measurements. Inspection of Lighthouse's main-thread records identified the optional Shopify account widget and its Shop frame/scripts among the work loaded on the guest shopping path. Customer-account UI is now a theme setting, disabled by default for this guest-checkout practice project. Shopify's required checkout, privacy and platform scripts remain managed by Shopify.

Final median transfer size fell by about 30% on home, 18% on collection and 21% on product. Home/product LCP improved in this sample. The collection LCP difference is small relative to run variation. **TBT did not improve versus baseline**; higher final medians and substantial variation remain visible. Removing bytes does not establish lower JavaScript blocking time.

## Limits and reproduction

This was one Windows development machine, not an isolated benchmarking host. A checkout test briefly shared the machine during the final batch. Shopify/CDN response time and third-party platform work varied. The local Chromium debugging connection closed after seven valid final runs; the harness resumed the remaining two product runs without replacing completed observations. These conditions limit causal claims about timing differences. No run was dropped because its score was poor.

```powershell
$env:SHOPIFY_THEME_ID = '<unpublished candidate ID>'
node scripts/performance.mjs before
# Make and upload the intended change.
node scripts/performance.mjs after
# Only after an interrupted batch with a saved checkpoint:
node scripts/performance.mjs after --resume
```

The measurements cover the candidate after the three optimizations above and before the later country-change cart-eligibility warning and theme metadata update. They are not a byte-for-byte benchmark of the final release. That warning runs after country changes and on the cart page. A later repeated benchmark should use an otherwise idle machine and preserve the same theme, consent, cache and authentication conditions. The next useful investigation is platform-script/main-thread variability, not a promise that the store now satisfies every performance threshold.
