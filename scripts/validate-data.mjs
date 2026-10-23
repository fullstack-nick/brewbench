import Ajv from "ajv";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export async function readManifest(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
export function validateRelations(products, collections, guides) {
  const errors = [];
  const handles = new Set();
  const skus = new Set();
  for (const p of products) {
    if (handles.has(p.handle)) errors.push(`Duplicate handle: ${p.handle}`);
    handles.add(p.handle);
    const combinations = new Set();
    for (const v of p.variants) {
      if (skus.has(v.sku)) errors.push(`Duplicate SKU: ${v.sku}`);
      skus.add(v.sku);
      if (
        v.options.length !== p.options.length ||
        v.options.some((x, i) => !p.options[i].values.includes(x))
      )
        errors.push(`Invalid options: ${v.sku}`);
      const combo = JSON.stringify(v.options);
      if (combinations.has(combo))
        errors.push(`Duplicate combination: ${v.sku}`);
      combinations.add(combo);
      if (Number(v.price) <= 0) errors.push(`Invalid price: ${v.sku}`);
    }
    if (p.guide && !guides.some((g) => g.handle === p.guide))
      errors.push(`Unknown guide: ${p.handle}`);
  }
  for (const p of products)
    for (const v of p.variants)
      for (const sku of v.compatibleSkus) {
        if (!skus.has(sku) || sku === v.sku)
          errors.push(`Invalid compatibility: ${v.sku} → ${sku}`);
      }
  for (const c of collections)
    for (const h of c.products)
      if (!handles.has(h)) errors.push(`Unknown collection member: ${h}`);
  for (const g of guides)
    for (const h of g.equipment)
      if (!handles.has(h)) errors.push(`Unknown guide equipment: ${h}`);
  return errors;
}
export async function validateData({ assets = true } = {}) {
  const [products, collections, guides, schema] = await Promise.all([
    readManifest("data/catalog/products.json"),
    readManifest("data/catalog/collections.json"),
    readManifest("data/content/guides.json"),
    readManifest("data/schema/product.schema.json"),
  ]);
  const check = new Ajv({ allErrors: true }).compile(schema);
  if (!check(products)) throw new Error(JSON.stringify(check.errors, null, 2));
  const errors = validateRelations(products, collections, guides);
  if (assets)
    for (const p of products)
      for (const m of p.media) {
        try {
          await access(m.file);
        } catch {
          errors.push(`Missing asset: ${m.file}`);
        }
      }
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    products,
    collections,
    guides,
    pages: await readManifest("data/content/pages.json"),
  };
}
if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = await validateData();
  console.log(
    `Valid: ${result.products.length} products; ${result.products.reduce((n, p) => n + p.variants.length, 0)} variants; exact compatibility references resolve.`,
  );
}
