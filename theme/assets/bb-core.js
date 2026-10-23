export const EXPERIMENT = 'compatible-filter-v1';
export const TTL = 30 * 24 * 60 * 60 * 1000;
export function consentAllowed(consent, allowed, optedOut = false) {
  return consent === 'yes' && allowed === true && optedOut !== true;
}
export function assignment(visitor, version = EXPERIMENT) {
  let hash = 2166136261;
  for (const char of `${version}:${visitor}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2 ? 'treatment' : 'control';
}
export function validAssignment(value, now = Date.now()) {
  return value && typeof value.visitor === 'string' && value.version === EXPERIMENT &&
    value.visitor.length > 0 && Array.isArray(value.exposures) && value.exposures.every(x => typeof x === 'string') &&
    Number.isFinite(value.createdAt) && now >= value.createdAt && now - value.createdAt < TTL;
}
export function exactVariant(variants, selected) {
  return variants.find(v => v.options.length === selected.length && v.options.every((value,i) => value === selected[i])) || null;
}
export function sanitizeEvent(event) {
  const strings = ['name','event_id','timestamp','visitor','session','country','locale','currency','release','experiment','group','source','product_id','variant_id','sku','transaction_id'];
  const numbers = ['quantity','unit_price','value','latency_ms','cls'];
  const booleans = ['consent','test_traffic','eligible'];
  return Object.fromEntries(Object.entries(event).filter(([key,value]) =>
    strings.includes(key) ? typeof value === 'string' && value.length <= 100 && !/[?@]/.test(value) :
    numbers.includes(key) ? typeof value === 'number' && Number.isFinite(value) && value >= 0 :
    booleans.includes(key) && typeof value === 'boolean'));
}
export function deduplicate(events) {
  const seen = new Set();
  return events.filter(event => {
    if (event.name === 'purchase' && !event.transaction_id) return false;
    const key = event.name === 'purchase' ? `purchase:${event.transaction_id}` : event.event_id;
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
