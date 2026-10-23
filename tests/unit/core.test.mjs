import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  consentAllowed,
  assignment,
  validAssignment,
  EXPERIMENT,
  TTL,
  exactVariant,
  sanitizeEvent,
  deduplicate,
} from "../../theme/assets/bb-core.js";
import {
  validateData,
  validateRelations,
} from "../../scripts/validate-data.mjs";
import { userErrors } from "../../scripts/store/client.mjs";
const products = JSON.parse(
  await readFile("data/catalog/products.json", "utf8"),
);
test("manifest integrity and exact brewer/filter compatibility", async () => {
  const data = await validateData();
  assert.equal(data.products.length, 24);
  const variants = products[0].variants;
  assert.equal(
    exactVariant(variants, ["02 · 500 ml", "Chalk"]).sku,
    "BB-CONE-02-CHALK",
  );
  assert.deepEqual(
    exactVariant(variants, ["02 · 500 ml", "Chalk"]).compatibleSkus,
    ["BB-17-STD", "BB-19-STD"],
  );
  assert.equal(exactVariant(variants, ["02 · 500 ml", "Olive"]), null);
  assert.equal(
    exactVariant(variants, ["01 · 250 ml", "Olive"]).initialStock,
    0,
  );
});
test("bad references and repeated combinations are rejected", () => {
  const p = structuredClone(products);
  p[0].variants[0].compatibleSkus = ["missing"];
  p[0].variants.push({ ...p[0].variants[0] });
  const errors = validateRelations(p, [], []);
  assert.ok(errors.some((e) => e.includes("Invalid compatibility")));
  assert.ok(errors.some((e) => e.includes("Duplicate combination")));
});
test("analytics needs affirmative consent, permission and no withdrawal", () => {
  for (const v of ["", undefined, "no", true])
    assert.equal(consentAllowed(v, true), false);
  assert.equal(consentAllowed("yes", false), false);
  assert.equal(consentAllowed("yes", true, true), false);
  assert.equal(consentAllowed("yes", true), true);
});
test("assignment is stable, balanced and expires safely", () => {
  const groups = Array.from({ length: 1000 }, (_, i) =>
    assignment(`visitor-${i}`),
  );
  assert.ok(groups.filter((g) => g === "control").length > 450);
  assert.equal(assignment("same"), assignment("same"));
  const good = {
    visitor: "same",
    version: EXPERIMENT,
    createdAt: 100,
    exposures: [],
  };
  assert.ok(validAssignment(good, 101));
  assert.ok(!validAssignment(good, 100 + TTL));
  assert.ok(!validAssignment({ ...good, exposures: null }, 101));
  assert.ok(!validAssignment({ ...good, version: "old" }, 101));
});
test("event allowlist removes private fields and malformed numbers", () => {
  assert.deepEqual(
    sanitizeEvent({
      name: "add_to_cart",
      email: "test@example.com",
      address: "not allowed",
      url: "https://example.com?token=secret",
      value: NaN,
      quantity: 1,
      currency: "EUR",
    }),
    { name: "add_to_cart", quantity: 1, currency: "EUR" },
  );
});
test("deduplication is by event ID and purchase transaction ID", () => {
  assert.equal(
    deduplicate([
      { name: "add_to_cart", event_id: "a" },
      { name: "add_to_cart", event_id: "a" },
      { name: "purchase", event_id: "b", transaction_id: "o1" },
      { name: "purchase", event_id: "c", transaction_id: "o1" },
      { name: "purchase", event_id: "d" },
    ]).length,
    2,
  );
});
test("nested mutation userErrors cannot masquerade as success", () => {
  assert.deepEqual(
    userErrors({
      a: { userErrors: [{ field: ["input"], message: "denied" }] },
    }),
    [{ operation: "a", field: ["input"], message: "denied" }],
  );
});
