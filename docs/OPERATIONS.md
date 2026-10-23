# Local operations

Use Node.js 24 and Shopify CLI 4.9.4. The committed lockfile pins tooling. Run `npm ci` locally; this command installs dependencies and is not a CI workflow. Then `npx playwright install chromium firefox webkit`. All checks and deployments are manual local commands.

## Access and setup

Use a free development store that already has test checkout enabled. This release's store is password protected. Sign-in/permission consent is allowed; the project does not depend on Shopify admin UI configuration. The initial organization setup and existing-password lookup are documented in the preflight. A new store may need a separate feasibility preflight; never assume payment settings are writable through Admin GraphQL.

Authenticate the CLI for the named store with:

```powershell
shopify store auth --store brewbench-practice.myshopify.com --scopes read_markets_home,write_markets,read_locations,read_orders,write_products,write_metaobject_definitions,write_metaobjects,write_content,write_online_store_navigation,write_locales,write_shipping,write_inventory,write_publications,write_translations
npm ci
npm run data:validate
npm run store:plan
npm run store:snapshot
npm run store:apply
node scripts/store/geography.mjs apply
npm run store:verify
node scripts/store/geography.mjs verify
```

The CLI manages tokens locally. `scripts/store/client.mjs` uses the official CLI entry point and pinned Admin API, never scraped cookies. Windows resolves the npm-global entry; on other hosts set `SHOPIFY_CLI_ENTRY`. `SHOPIFY_STORE` selects the store, but geography and sample-retirement exercises deliberately guard the dedicated practice domain. Adapting to a different store requires reviewing those guards and its initial state.

Store the existing storefront password in `.local/preflight/storefront-password.txt` or set `SHOPIFY_PASSWORD_FILE`. Keep this file, CLI tokens, `.shopify`, browser storage, IDs, order evidence and raw logs private. The public `.env.example` contains no credentials and is not loaded automatically.

This store requires the 2026-10 market-level `delivery.shipping` options. The geography command configures and verifies them as well as legacy profiles. A successful legacy-profile mutation alone is not checkout evidence.

## Safe repeat runs

Product handles and variant SKUs resolve existing records. Changed hashes prevent unnecessary writes. Relationships are reconciled after `productSet`, which synchronizes list fields. Translations fetch current digests. Definitions and media are reused; media must finish processing. Inventory initializes once with compare-and-set; reruns preserve stock changed by test orders. `npm run store:inventory-reset` is an explicit destructive-to-test-stock operation, never part of ordinary apply.

Snapshots and change ledgers are under `.local/store`. Bounded retries apply only to reads and explicitly idempotent mutations; validation/user errors stop immediately. Unknown outcomes of creates must be resolved by a lookup before retrying. The tool checks nested `userErrors`; CLI exit code alone is not sufficient evidence. Do not run two writers against the same state file.

Generated development-store samples were archived and unpublished, not deleted. `retire-samples.mjs` restricts itself to the initial dedicated-store snapshot. It is not a general catalog cleanup command.

To verify repeatability explicitly, run `node scripts/store/idempotence-check.mjs` without another writer or test-order creation in progress. It compares resource identities, counts and inventory before/after an ordinary apply, including stock consumed by test orders.

## Checks and deployment

```powershell
npm run check
npm run theme:check
npm run test:browser
npx playwright test --config playwright.checkout.config.mjs
npx playwright test --config playwright.exercises.config.mjs
$env:SHOPIFY_THEME_ID = '<candidate theme ID from your private ledger>'
node scripts/performance.mjs before
# Apply a measured optimization, push it, then repeat:
node scripts/performance.mjs after
shopify theme push --store brewbench-practice.myshopify.com --theme $env:SHOPIFY_THEME_ID --path theme --json
shopify theme publish --store brewbench-practice.myshopify.com --theme $env:SHOPIFY_THEME_ID --path theme --force
```

Inspect theme JSON for `errors`, run the browser smoke journey, and retain the previous live theme ID. The performance harness measures three runs per route with an authenticated mobile simulation; raw reports stay private. Do not accept measurements of the password/challenge screen. Respect Shopify throttling and stop on verification challenges instead of attempting to bypass them.

Rollback is `shopify theme publish` with the retained previous theme ID. Verify its live role and storefront, then republish the known-good release when the rehearsal is complete. Theme rollback does **not** restore catalog data. For data recovery, inspect the private before/after ledger, change only the affected resource using a supported mutation, verify it, and reapply the intended manifest. Do not replay an entire stale inventory snapshot. UK rate recovery is `node scripts/store/geography.mjs uk-rate-on` followed by `verify` and checkout validation.

The checkout command places a real **test** order through the bogus gateway using fictional `example.com` contact details. It verifies three rates, a rejected card `2`, then an approved card `1`. It reduces test inventory. The exercises deliberately alter a browser form and shared guide, restoring the guide in `finally`. `node scripts/configuration-qa.mjs` requires an unpublished candidate, uploads temporary duplicate/empty-image templates and disables the experiment, then restores the exact settings and removes those templates.

No automatic deployment, CI checks, required status checks or paid services are configured. Review the local results before merging and creating a release tag. See [release evidence](RELEASE.md) and [QA](QA.md) for what was actually exercised.
