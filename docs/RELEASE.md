# Release 1.0.0

Repository: [fullstack-nick/brewbench](https://github.com/fullstack-nick/brewbench). Store: [Brewbench practice](https://brewbench-practice.myshopify.com), free and password protected. This is a fictional demonstration with a test gateway, not a production launch.

The feature branch is `feat/brewbench-storefront`; [pull request #1](https://github.com/fullstack-nick/brewbench/pull/1) records the reviewable implementation. The release is tagged `v1.0.0`. No GitHub Actions, remote status requirements or deployment automation are configured.

## Release evidence

Validated storefront source: commit [`83173bc881722f5ab9ca00f9fc26780e577ac86e`](https://github.com/fullstack-nick/brewbench/commit/83173bc881722f5ab9ca00f9fc26780e577ac86e), theme Git tree `9b96f1b728757eae3b0783bc42184a1b7df54624`. Later delivery commits add the live smoke harness, screenshots and release records; they do not change this theme tree. The final tag includes those records. Performance measurements predate the late cart-eligibility notice, as explained in the [performance report](PERFORMANCE.md).

- 11 unit tests and catalog/format checks passed.
- 37 storefront checks passed with zero skips, failures or flaky retries across four browser profiles.
- Theme Check: zero errors, nine retained Dawn warnings.
- Native API reads confirm the catalog, references, German translations, markets and active delivery options.
- Repeat apply preserved resource identities/counts and inventory consumed by the test order.
- The hosted checkout verified AT/DE/GB rates, rejected a test payment and completed a paid test order for the exact brewer/filter pair.
- Duplicate sections, missing imagery, experiment shutdown, shared-content editing and all three controlled incidents have reviewable evidence.

Raw theme IDs, API state, order records, tokens and browser storage are kept in ignored `.local/`. Public reports contain sanitized counts, fictional test details and source/version identifiers.

## Deployment and rollback

On 23 October 2026 the CLI published Brewbench, republished the preceding `test-data` theme, and restored Brewbench. Fresh password-authenticated sessions without preview URLs verified each final state:

- **07:47:45 UTC:** [rollback smoke passed](evidence/rollback-smoke.json); the original theme served the storefront.
- **07:48:03 UTC:** [release smoke passed](evidence/release-smoke.json); Brewbench served home, collection, English/German product, guide, delivery, FAQ, cart, search and 404 routes with expected status codes.
- The final CLI theme listing independently confirmed `Brewbench 1.0.0` has the live role and the original theme remains unpublished and available for rollback.
- Product SEO checks confirmed description, canonical path, native EN/DE/x-default alternates and Shopify's `ProductGroup` with all three `Product` variants, exact SKUs, EUR prices and variant offers.

The first smoke harness incorrectly expected a top-level `Product`; inspection showed Shopify correctly emits a `ProductGroup` for variants. The harness now checks the group and exact variant offers. A reused preview session also remained pinned to its candidate theme after rollback; live verification now starts with a fresh password-authenticated visitor. Those initial failures are not counted as passing rollback evidence.

The frozen candidate was published and rehearsed before the final evidence commit/tag, so the tag includes actual deployment results. Theme rollback only changes theme code: it does not undo catalog, translation, inventory or shipping writes. The original theme is retained, and selective data recovery follows [operations](OPERATIONS.md).

The release asset is `Brewbench-1.0.0.zip`, SHA-256 `1399274d1856f81d00f92aff005c7f49526ee76231d8ffb47ea87b3551239a83`. The [GitHub release](https://github.com/fullstack-nick/brewbench/releases/tag/v1.0.0) includes the theme ZIP and walkthrough MP4.

The archive was repackaged after the initial tag to include the theme and font license notices that Shopify's default packager omits. [Packaging correction #2](https://github.com/fullstack-nick/brewbench/pull/2) adds the reproducible local wrapper. CRC checks passed and all 321 theme files were compared byte-for-byte with the source; the only additional file is the generated, non-executable `assets/brewbench-third-party-notices.txt`. The storefront code and release theme Git tree did not change. The hash above supersedes the initial archive hash recorded in the tag's historical delivery document.

## Review boundaries

This project is self-reviewed; it does not claim independent human approval. Review focuses on exact variant payloads, stale-response handling, partial stock additions, locale URLs, market eligibility, affirmative consent, event deduplication, idempotent store writes and public-artifact hygiene. The public PR is the reviewable record. The native theme editor, production payments/tax, physical devices and installed purchase-pixel delivery are outside the agreed scope.
