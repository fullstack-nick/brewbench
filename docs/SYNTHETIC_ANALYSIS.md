# Synthetic experiment analysis

**Every row is generated, not observed shopper behavior. No conversion lift is claimed.**

Reproduce with `node analytics/generate.mjs` then `npm run analytics:report`. Seed: 20261023. Exposure is the denominator; assignment alone never counts. Successful brewer additions are unique exposed visitors adding the viewed product within seven days after exposure. Compatible additions and purchases are secondary visitor counts.

13812 raw events; 365 duplicates removed; 1651 events excluded for consent, QA traffic or context; 37 visitors lacked exposure; 0 assignment conflicts. Missing exposures are excluded, not imputed. Missing purchases understate conversion and cannot be reconstructed from these events.

| Group | Exposed | Brewer added | Add rate | 95% Wilson interval | Filter attached | Purchased | Errors | p75 latency ms |
|---|---:|---:|---:|---|---:|---:|---:|---:|
| control | 1659 | 301 | 18.14% | 16.36%–20.07% | 67 | 74 | 15 | 233 |
| treatment | 1815 | 323 | 17.80% | 16.11%–19.62% | 149 | 79 | 57 | 256 |

## Market and device diagnosis

| Segment / group | Exposed | Brewer added | Add rate | 95% interval | Filter attached | Purchased | Errors | p75 latency ms |
|---|---:|---:|---:|---|---:|---:|---:|---:|
| AT/desktop / control | 274 | 44 | 16.06% | 12.19%–20.87% | 8 | 11 | 5 | 231 |
| AT/desktop / treatment | 306 | 53 | 17.32% | 13.49%–21.96% | 23 | 15 | 4 | 231 |
| AT/mobile / control | 277 | 45 | 16.25% | 12.37%–21.05% | 15 | 12 | 2 | 233 |
| AT/mobile / treatment | 302 | 61 | 20.20% | 16.06%–25.09% | 29 | 15 | 3 | 234 |
| DE/desktop / control | 276 | 59 | 21.38% | 16.95%–26.59% | 17 | 11 | 1 | 233 |
| DE/desktop / treatment | 302 | 79 | 26.16% | 21.52%–31.39% | 38 | 16 | 8 | 226 |
| DE/mobile / control | 277 | 47 | 16.97% | 13.01%–21.83% | 9 | 15 | 3 | 232 |
| DE/mobile / treatment | 302 | 58 | 19.21% | 15.16%–24.02% | 28 | 16 | 5 | 234 |
| GB/desktop / control | 277 | 51 | 18.41% | 14.29%–23.40% | 7 | 18 | 2 | 233 |
| GB/desktop / treatment | 302 | 56 | 18.54% | 14.56%–23.31% | 23 | 13 | 4 | 239 |
| GB/mobile / control | 278 | 55 | 19.78% | 15.53%–24.87% | 11 | 7 | 2 | 234 |
| GB/mobile / treatment | 301 | 16 | 5.32% | 3.30%–8.46% | 8 | 4 | 33 | 758 |

The generator intentionally lowers the treatment's UK-mobile add probability and increases its latency, errors and layout shift. Segmenting exposes that anomaly; aggregate results alone conceal the different experience. This is a diagnostic exercise, not evidence about the delivered theme. Pause a real rollout on such a guardrail failure and inspect market-specific requests before interpreting conversion.

## Analysis contract

Baseline 16% brewer-add rate, target 15% relative improvement (18.4%, +2.4 percentage points), two-sided alpha 0.05 and 80% power. The two-independent-proportions normal approximation gives **3881 exposed visitors per arm**. Formula: [1.96√(2p̄(1−p̄)) + 0.8416√(p₁(1−p₁)+p₂(1−p₂))]² / (p₂−p₁)². This synthetic sample is below that target.

For a real study: run at least 14 complete days and until both arms reach the target; stop at 28 days as inconclusive if they do not. No early efficacy stopping or repeated significance peeking. Stop immediately for shopping failures/privacy defects; predeclare guardrail review. Segment comparisons are exploratory and not independently powered. A 30-day assignment expiry is fixed for this version.

50:50 sample-ratio chi-square = 7.005 (1 degree of freedom; alert threshold 10.828 at p<0.001): no alert. This check does not establish that instrumentation is complete. Guardrails: error visitors / exposed, p75 interaction latency, p75 CLS, SRM. CLS and latency here are synthetic; real lab evidence is reported separately.

## Evidence boundaries

Theme events prove views, observed exposure and successful Ajax additions. A checkout click is named `checkout_click`; it is not `checkout_started`. Checkout and purchase customer-event adapters are fixture-tested only. The separate real browser test order demonstrates checkout, not installation of a purchase pixel. No external analytics service receives these data.
