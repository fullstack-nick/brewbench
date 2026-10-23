import { join } from "node:path";
import { graphql, paginate, json, save, privateDir, store } from "./client.mjs";
if (store !== "brewbench-practice.myshopify.com")
  throw new Error(
    "Sample cleanup is restricted to the dedicated practice store.",
  );
const state = await json(join(privateDir, "state.json"));
const baseline = await json(state.snapshot);
const originalIds = new Set(
  baseline.products.filter((p) => p.vendor !== "Brewbench").map((p) => p.id),
);
const products = await paginate("products", "products");
const env = await graphql("environment");
const online = env.publications.nodes.find((p) =>
  p.catalog?.title?.endsWith(" for Online Store"),
);
const candidates = products.filter(
  (p) => originalIds.has(p.id) || p.handle === "brewbench-preflight-probe",
);
const path = join(privateDir, "archived-sample-ledger.json");
const ledger = await json(path, []);
for (const p of candidates) {
  if (p.status === "ARCHIVED") continue;
  ledger.push({ at: new Date().toISOString(), before: p });
  await save(path, ledger);
  await graphql(
    "unpublish",
    { id: p.id, input: [{ publicationId: online.id }] },
    { idempotent: true },
  );
  await graphql(
    "product-update",
    { product: { id: p.id, status: "ARCHIVED" } },
    { idempotent: true },
  );
  console.log(`Archived generated sample: ${p.handle}`);
}
console.log(
  "Generated samples are archived, with prior state retained privately.",
);
