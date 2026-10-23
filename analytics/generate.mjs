import { mkdir, writeFile } from "node:fs/promises";
import { assignment, EXPERIMENT } from "../theme/assets/bb-core.js";
export function syntheticEvents(count = 4000) {
  let state = 20261023;
  const random = () =>
    (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296;
  const events = [];
  for (let i = 0; i < count; i++) {
    const visitor = `synthetic-${String(i).padStart(5, "0")}`,
      session = `session-${i}`,
      group = assignment(visitor),
      country = ["AT", "DE", "GB"][i % 3],
      device = i % 2 ? "mobile" : "desktop";
    const base = {
      visitor,
      session,
      group,
      country,
      device,
      locale: country === "GB" ? "en" : "de",
      currency: "EUR",
      release: "1.0.0",
      experiment: EXPERIMENT,
      consent: i % 11 !== 0,
      test_traffic: i % 29 === 0,
      source: "synthetic",
      product_id: "cone-brewer",
      eligible: true,
    };
    let tick = 0;
    const emit = (name, extra = {}) => {
      const e = {
        ...base,
        name,
        event_id: `syn-${i}-${tick}`,
        timestamp: new Date(Date.UTC(2026, 9, 1) + i * 420000 + tick++ * 1000),
        ...extra,
      };
      events.push(e);
      if (i % 37 === 0) events.push({ ...e });
    };
    emit("view_item");
    if (i % 97 !== 0) emit("experiment_exposure");
    const anomaly =
      country === "GB" && device === "mobile" && group === "treatment";
    emit("interaction_timing", {
      latency_ms: Math.round((anomaly ? 650 : 120) + random() * 150),
      cls: anomaly ? 0.12 : 0.01,
    });
    if (random() < (anomaly ? 0.12 : 0.01)) emit("interaction_error");
    const added =
      random() < (anomaly ? 0.065 : group === "treatment" ? 0.2 : 0.16);
    if (added) {
      emit("add_to_cart", {
        quantity: 1,
        unit_price: 38,
        variant_id: "BB-CONE-02-CHALK",
      });
      if (random() < (group === "treatment" ? 0.42 : 0.23))
        emit("compatible_add", { quantity: 1, variant_id: "BB-17-STD" });
      if (random() < 0.35) {
        emit("begin_checkout");
        if (random() < 0.7 && i % 53 !== 0)
          emit("purchase", {
            transaction_id: `synthetic-order-${i}`,
            value: 38,
          });
      }
    }
  }
  return events;
}
if (process.argv[1]?.endsWith("generate.mjs")) {
  await mkdir("analytics/data", { recursive: true });
  const events = syntheticEvents();
  await writeFile(
    "analytics/data/synthetic-events.jsonl",
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
  console.log(
    `Generated ${events.length} deterministic synthetic events. No real customer data.`,
  );
}
