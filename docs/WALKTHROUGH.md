# Recorded walkthrough

[Watch/download the MP4](evidence/brewbench-walkthrough.mp4) · [Chapter timings](evidence/walkthrough-chapters.json)

The recording contains three chapters:

1. A German customer selects the large Cone Brewer and the exact matching paper filters, switches to the UK and English, checks three country rates, sees a rejected test payment and completes a successful test order.
2. An intentionally stale hidden variant ID adds the wrong size. Reloading the shipped implementation fixes it. One shared-guide API edit then appears on both brewer pages; the original content is restored.
3. A local report displays the actual before/after performance measurements, including higher blocking-time medians and the limits of the timing comparison.

The first two chapters are real browser recordings of the development storefront. The third is a clearly labeled report built from committed measurement JSON. There is no simulated checkout screen, real card, real customer address, password capture or claim of observed conversion improvement. The checkout uses fictional `example.com` details; its confirmation reference is redacted. The injected defect exists only in the exercise browser document.

Rebuild with `node scripts/walkthrough.mjs` after saving the successful checkout and engineering exercise videos as ignored `.local/walkthrough/customer.webm` and `engineering.webm`. The command requires FFmpeg/ffprobe and records the local metrics report before combining the clips. Raw traces and browser state remain private.
