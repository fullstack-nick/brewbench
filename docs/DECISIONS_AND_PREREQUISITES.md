# Decisions and prerequisites

Updated 23 October 2026. Companion to the [implementation plan](IMPLEMENTATION_PLAN.md) and [feasibility research](FEASIBILITY.md).

## Decisions confirmed by the user

| Decision | Result |
|---|---|
| Store hosting | Free Shopify development store; public GitHub presentation |
| Shopify configuration UI | No admin configuration; only the explicit setup/access exceptions below |
| Authentication | Sign-in and permission-consent screens are allowed |
| Developer enrollment | Completed; organization access and CLI dev-store creation verified |
| Storefront password | One-time read-only lookup approved; existing password saved locally by the user |
| CI | None; all validation, tests, deployment and rollback run locally |
| Advanced extensions | Core project only; exclude all four extensions |
| Current developer access | Owner access to `brewbench-practice.myshopify.com` verified through Shopify CLI |
| Brand independence | Independent fictional naming/content/assets throughout |
| Execution preference | Research and resolve prerequisites first, then implement end to end in one continuous effort |

## Recommended technical decisions

These are implementation choices, not additional requests for user input.

| Decision | Recommendation and reason |
|---|---|
| Store type | Basic-configured dev store with generated test data, country AT, no feature preview. Generated data supplies the test payment gateway. |
| Theme | Dawn v16.0.0, pinned commit, Liquid/CSS/vanilla JS. Closely matches the intended practice. |
| Data ownership | Merchant-owned definitions and repeatable source manifests. Theme data should not depend on a removable custom app. |
| Data execution | Shopify plugin where available; validated CLI Admin GraphQL as the reproducible fallback. |
| Deployment | Shopify theme CLI, using the owner's authenticated session. |
| Discovery | Curated category/method collections plus sorting, pagination, search. Native facets are used only if already configured. |
| Currency | EUR verified after creation; one real store currency across all markets, no GBP payment promise. |
| Languages | English and German; preserve the actual primary locale and translate/publish the other. |
| Analytics | Theme-side consent-aware QA recorder, event mapping fixtures, synthetic analysis, implemented CRO experience. No installed pixel/GA4 dependency. |
| App evaluation | Search & Discovery evidence-based memo. No app installation or invented before/after measurement. |
| Validation | Documented local check/test commands with release evidence; no CI service, workflows, or required remote statuses. |
| GitHub destination | `fullstack-nick/brewbench`, assuming no naming collision at creation time. |
| Design | Original warm coffee-equipment visual system; native Figma creation/editing verified. Reuse the file linked in the preflight report. |
| Runtime hosting | Shopify theme hosting only; no separate always-on server. |

## Approved setup exceptions

**The user approved one-time free Shopify developer/Partner organization enrollment on 23 October 2026.**

This permission is separate from ordinary Shopify sign-in and permission consent. Official dev-store creation requires an eligible organization, and no supported CLI organization-creation command was found. Enrollment is now verified: CLI organization listing and dedicated development-store creation both succeeded.

The user completed enrollment under their existing account. Store creation, data setup and theme deployment use supported CLI/API paths. The created store is a free development store; no paid merchant subscription was created.

The user also approved one read-only admin visit to retrieve the existing storefront password. The automated Preferences panel stalled, so the user saved the password in ignored local storage. This permits storefront and local theme-proxy access; it does not authorize admin configuration or changing the password. Storefront access, local preview, and actual test checkout are verified. See the [preflight report](PREFLIGHT_REPORT.md) for evidence.

## Technical gates

| Gate | What must be verified | If it fails |
|---|---|---|
| Developer access | Passed: organization listed and dev store created | Recheck if account access changes |
| Store connectivity | Passed through authorized CLI; plugin store reconnection unavailable | Use CLI execution and plugin schema tools |
| Scope coverage | Passed: core data write probes and readbacks, theme upload | Validate exact operations again when implementing |
| Storefront access | Passed: password, hosted preview, product/cart, local theme server | Keep password and browser state outside Git |
| Test payment | Passed: rejected test payment, then confirmed order #1001; API verified test=true, PAID, bogus gateway | Repeat the complete journey against the finished storefront |
| Currency/locale | Passed: EUR and primary English; German enabled unpublished | Preserve this acceptance profile |
| Figma edit access | Passed: owned Design file created and page edited | Reuse the verified file |
| Publish/rollback | Passed: probe published and original live theme restored | Repeat against the finished release |

The CLI's creation result did not supply a storefront password, and owner sign-in alone did not unlock the preview in this session. The approved existing-password lookup resolved access without changing settings. The password is excluded from version control.

## Evidence labels

Every QA/report entry should use one of these labels:

- **Observed on store:** browser/API evidence from the intended store, with release and environment.
- **Locally tested:** source/tooling behavior tested independently of Shopify.
- **Fixture tested:** a controlled payload or synthetic dataset; never a claim of observed customer activity.
- **Documentation verified:** an official supported capability, not yet tested in this account.
- **Not verified:** access or environment prevented the test.
- **Excluded by scope:** intentional omission accepted in this research phase.

Preflight has passed for the agreed core scope. There are no outstanding user decisions or preflight blockers. The project is ready for the uninterrupted implementation run; branded storefront functionality and its release acceptance tests still belong to that run.
