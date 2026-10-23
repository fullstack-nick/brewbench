# Release 1.0.0

Repository: [fullstack-nick/brewbench](https://github.com/fullstack-nick/brewbench). Store: [Brewbench practice](https://brewbench-practice.myshopify.com), free and password protected. This is a fictional demonstration with a test gateway, not a production launch.

The feature branch is `feat/brewbench-storefront`. The release review records local checks, store data verification, browser journeys and known scope limits. No GitHub Actions, remote status requirements or deployment automation are configured.

## Candidate evidence

- 11 unit tests and catalog/format checks passed.
- 37 storefront checks passed with zero skips, failures or flaky retries across four browser profiles.
- Theme Check: zero errors, nine retained Dawn warnings.
- Native API reads confirm the catalog, references, German translations, markets and active delivery options.
- Repeat apply preserved resource identities/counts and inventory consumed by the test order.
- The hosted checkout verified AT/DE/GB rates, rejected a test payment and completed a paid test order for the exact brewer/filter pair.
- Duplicate sections, missing imagery, experiment shutdown, shared-content editing and all three controlled incidents have reviewable evidence.

Raw theme IDs, API state, order records, tokens and browser storage are kept in ignored `.local/`. Public reports contain sanitized counts, fictional test details and source/version identifiers.

## Deployment and rollback

Publication and rollback results are recorded below after the live-theme checks complete. Theme rollback only changes theme code: it does not undo catalog, translation, inventory or shipping writes. The original theme is retained, and selective data recovery follows [operations](OPERATIONS.md).

## Review boundaries

This project is self-reviewed; it does not claim independent human approval. Review focuses on exact variant payloads, stale-response handling, partial stock additions, locale URLs, market eligibility, affirmative consent, event deduplication, idempotent store writes and public-artifact hygiene. The public PR is the reviewable record. The native theme editor, production payments/tax, physical devices and installed purchase-pixel delivery are outside the agreed scope.
