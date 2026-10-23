import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { paginate, save } from "./client.mjs";
const exec = promisify(execFile);
async function snapshot() {
  const products = await paginate("products", "products");
  const pages = await paginate("pages", "pages");
  const collections = await paginate("collections", "collections");
  return {
    products: products.map((p) => ({
      id: p.id,
      handle: p.handle,
      variants: p.variants.nodes.map((v) => ({
        id: v.id,
        sku: v.sku,
        inventory: v.inventoryQuantity,
      })),
    })),
    pages: pages.map((p) => p.id).sort(),
    collections: collections.map((c) => c.id).sort(),
  };
}
const before = await snapshot();
await save(".local/store/idempotence-before.json", before);
const result = await exec(
  process.execPath,
  ["scripts/store/run.mjs", "apply"],
  { windowsHide: true, maxBuffer: 5e6, timeout: 900000 },
);
await save(".local/store/idempotence-apply.json", {
  stdout: result.stdout,
  stderr: result.stderr,
});
const after = await snapshot();
await save(".local/store/idempotence-after.json", after);
assert.deepEqual(
  after,
  before,
  "Repeat apply must preserve identities, counts and live inventory",
);
const variants = after.products.flatMap((p) => p.variants);
await save("docs/evidence/idempotence.json", {
  at: new Date().toISOString(),
  passed: true,
  existingProductCount: after.products.length,
  activeManifestProducts: 24,
  existingCollectionCount: after.collections.length,
  existingPageCount: after.pages.length,
  identitiesPreserved: true,
  inventoryPreserved: true,
  largeBrewerRemaining: variants.find((v) => v.sku === "BB-CONE-02-CHALK")
    .inventory,
  note: "Includes archived generated sample products. Ordinary apply did not reset stock consumed by the real test order.",
});
console.log(
  "Repeat apply preserved resource identities, counts and test-order inventory.",
);
