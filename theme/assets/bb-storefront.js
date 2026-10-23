import { EXPERIMENT, TTL, assignment, validAssignment, consentAllowed, sanitizeEvent, deduplicate } from './bb-core.js';

const context = JSON.parse(document.getElementById('BrewbenchContext').textContent);
// Liquid root_url is /de; the Ajax endpoint needs /de/cart, with a separator.
context.root = context.root.endsWith('/') ? context.root : `${context.root}/`;
const panel = document.querySelector('[data-bb-consent]');
const status = panel.querySelector('[data-consent-status]');
const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* Browsing remains available. */ } },
};
let privacy; let analytics = false; let state; let session; let events = []; let productViewed = false;
let layoutShift=0;
try { new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)layoutShift+=entry.value;}).observe({type:'layout-shift',buffered:true}); } catch { /* This browser has no layout-shift observer. */ }
const forcedGroup = new URLSearchParams(location.search).get('bb_group');
const testTraffic = ['control','treatment'].includes(forcedGroup);
function purge() {
  analytics=false;state=null;session=null;events=[];productViewed=false;
  ['bb:experiment','bb:events'].forEach(storage.remove);
  try { sessionStorage.removeItem('bb:session'); } catch { /* No tracking without storage. */ }
}
function group() { return analytics && context.experimentEnabled ? (testTraffic ? forcedGroup : assignment(state.visitor)) : 'standard'; }
function record(name, data={}) {
  if (!analytics || !consentAllowed(privacy?.currentVisitorConsent?.().analytics,privacy?.analyticsProcessingAllowed?.(),storage.get('bb:analytics-optout')===true)) return false;
  const event=sanitizeEvent({name,event_id:crypto.randomUUID(),timestamp:new Date().toISOString(),visitor:state.visitor,session,country:context.country,locale:context.locale,currency:context.currency,release:context.release,experiment:EXPERIMENT,group:group(),consent:true,test_traffic:testTraffic,source:'theme-observed',...data});
  events=deduplicate([...events,event]).slice(-200);
  if(!storage.set('bb:events',events)){purge();document.dispatchEvent(new Event('bb:consent-changed'));return false;}
  document.dispatchEvent(new CustomEvent('bb:analytics',{detail:event}));return true;
}
function refreshConsent() {
  const permitted=consentAllowed(privacy?.currentVisitorConsent?.().analytics,privacy?.analyticsProcessingAllowed?.(),storage.get('bb:analytics-optout')===true);
  if (!permitted) purge();
  else {
    state=storage.get('bb:experiment');
    if(!validAssignment(state)) { storage.remove('bb:events');state={visitor:crypto.randomUUID(),version:EXPERIMENT,createdAt:Date.now(),exposures:[]}; }
    if(!storage.set('bb:experiment',state)){purge();return;}
    try { const saved=JSON.parse(sessionStorage.getItem('bb:session')); session=saved&&Date.now()-saved.at<TTL?saved.id:crypto.randomUUID(); sessionStorage.setItem('bb:session',JSON.stringify({id:session,at:Date.now()})); }
    catch {purge();return;}
    events=(storage.get('bb:events')||[]).filter(e=>Date.now()-Date.parse(e.timestamp)<TTL);
    analytics=true;
    if(context.product&&!productViewed){productViewed=true;record('view_item',{product_id:String(context.product.id),variant_id:String(context.product.variant),unit_price:context.product.price/100,quantity:1});}
  }
  document.dispatchEvent(new Event('bb:consent-changed'));
}
function privacyFailure() { purge();panel.hidden=false;status.textContent=context.strings.unavailable;document.dispatchEvent(new Event('bb:consent-changed')); }
let privacyOpener;
document.addEventListener('click',event=>{
  const open=event.target.closest('[data-bb-privacy-open]');
  if(open){privacyOpener=open;panel.hidden=false;panel.querySelector('button').focus();}
  const action=event.target.closest('[data-consent]')?.dataset.consent;
  if(!action)return;
  if(action==='close'){panel.hidden=true;privacyOpener?.focus();return;}
  const accept=action==='accept';
  if(!accept){storage.set('bb:analytics-optout',true);purge();document.dispatchEvent(new Event('bb:consent-changed'));}
  if(!privacy){privacyFailure();return;}
  const buttons=[...panel.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  let complete=false;
  const timeout=setTimeout(()=>{if(!complete){buttons.forEach(b=>b.disabled=false);privacyFailure();}},8000);
  try {
    privacy.setTrackingConsent({analytics:accept},()=>{
      complete=true;clearTimeout(timeout);buttons.forEach(b=>b.disabled=false);
      if(accept)storage.remove('bb:analytics-optout');
      refreshConsent();status.textContent=context.strings.saved;panel.hidden=true;privacyOpener?.focus();
    });
  }catch{clearTimeout(timeout);buttons.forEach(b=>b.disabled=false);privacyFailure();}
});
document.addEventListener('visitorConsentCollected',refreshConsent);
if(window.Shopify?.loadFeatures){
  const timeout=setTimeout(privacyFailure,8000);
  window.Shopify.loadFeatures([{name:'consent-tracking-api',version:'0.2'}],error=>{
    clearTimeout(timeout);if(error||!window.Shopify.customerPrivacy){privacyFailure();return;}
    privacy=window.Shopify.customerPrivacy;refreshConsent();
    panel.hidden=!!privacy.currentVisitorConsent().analytics || storage.get('bb:analytics-optout')===true;
  });
}else privacyFailure();

class BrewbenchCompatibility extends HTMLElement {
  connectedCallback(){this.abort=new AbortController();document.addEventListener('bb:consent-changed',()=>this.renderGroup(),{signal:this.abort.signal});this.renderGroup();}
  disconnectedCallback(){this.abort?.abort();this.observer?.disconnect();}
  renderGroup(){
    this.observer?.disconnect();
    const eligible=this.dataset.eligible==='true'&&this.dataset.experimentEnabled==='true'&&!!this.querySelector('bb-quick-add');
    this.dataset.group=eligible?group():'standard';
    if(!analytics||!eligible||!context.experimentEnabled)return;
    const trigger=this.closest('product-info')?.querySelector('.product-form__buttons');
    if(!trigger)return;
    this.observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.5)||document.visibilityState!=='visible')return;
      const key=`${this.dataset.product}:${EXPERIMENT}:${testTraffic?forcedGroup:'production'}`;
      if(!state.exposures.includes(key)){
        if(record('experiment_exposure',{product_id:this.dataset.product,variant_id:this.dataset.variant,eligible:true})){state.exposures.push(key);storage.set('bb:experiment',state);}
      }
      this.observer.disconnect();
    },{threshold:.5});
    this.observer.observe(trigger);
  }
}
if(!customElements.get('bb-compatibility'))customElements.define('bb-compatibility',BrewbenchCompatibility);
class BrewbenchQuickAdd extends HTMLElement {
  connectedCallback(){this.abort=new AbortController();this.querySelector('form').addEventListener('submit',event=>this.add(event),{signal:this.abort.signal});}
  disconnectedCallback(){this.abort?.abort();}
  async add(event){
    event.preventDefault();if(this.busy)return;this.busy=true;
    const started=performance.now();let added=false;
    const form=event.target;const button=form.querySelector('button');const error=form.querySelector('[role=alert]');
    const drawer=document.querySelector('cart-drawer');const body=new FormData(form);const quantity=Number(body.get('quantity')||1);const eventId=crypto.randomUUID();
    button.disabled=true;button.setAttribute('aria-busy','true');error.hidden=true;
    if(drawer){body.append('sections',drawer.getSectionsToRender().map(s=>s.id).join(','));body.append('sections_url',location.pathname);drawer.setActiveElement(button);}
    try{
      const response=await fetch(`${context.root}cart/add.js`,{method:'POST',body,headers:{'X-Requested-With':'XMLHttpRequest'}});
      const result=await response.json();if(!response.ok||result.status)throw Object.assign(new Error('Cart request rejected'),{userMessage:result.description||context.strings.error});
      added=true;
      document.dispatchEvent(new CustomEvent('bb:cart-added',{detail:{result,quantity,eventId}}));
      record('interaction_timing',{variant_id:String(body.get('id')),latency_ms:Math.round(performance.now()-started),cls:layoutShift,source:'compatible-add'});
      if(drawer&&result.sections&&Object.values(result.sections).every(Boolean)){drawer.classList.remove('is-empty');drawer.renderContents(result);}else location.assign(`${context.root}cart`);
      if(typeof publish==='function')publish(PUB_SUB_EVENTS.cartUpdate,{source:'bb-quick-add',productVariantId:String(result.variant_id),cartData:result});
    }catch(exception){if(added){location.assign(`${context.root}cart`);return;}error.textContent=exception.userMessage||context.strings.error;error.hidden=false;drawer?.refreshContents?.().catch(()=>{});record('interaction_error',{variant_id:String(body.get('id')),source:'compatible-add'});}
    finally{button.disabled=false;button.removeAttribute('aria-busy');this.busy=false;}
  }
}
if(!customElements.get('bb-quick-add'))customElements.define('bb-quick-add',BrewbenchQuickAdd);
document.addEventListener('bb:cart-added',({detail:{result,quantity,eventId}})=>{
  record('add_to_cart',{event_id:eventId,product_id:String(result.product_id),variant_id:String(result.variant_id||result.id),sku:result.sku||'',unit_price:Number(result.final_price??result.price)/100,quantity,value:Number(result.final_price??result.price)/100*quantity});
});
document.addEventListener('click',event=>{
  if(event.target.closest('[name=checkout],a[href$="/checkout"]'))record('checkout_click');
});

// The snapshot is an essential, one-navigation cart reconciliation aid, never an analytics record.
async function rememberMarketChange(){
  try{const response=await fetch(`${context.root}cart.js`);if(!response.ok)return;const cart=await response.json();sessionStorage.setItem('bb:market-switch',JSON.stringify({at:Date.now(),country:context.country,locale:context.locale,items:cart.items.map(i=>({id:i.variant_id,quantity:i.quantity}))}));}catch{/* Country switching must still work. */}
}
window.BrewbenchBeforeLocalization=rememberMarketChange;
let eligibilityController;
async function warnUnavailableItems(cart) {
  eligibilityController?.abort(); eligibilityController=new AbortController();
  const controller=eligibilityController;const signal=controller.signal;
  const timeout=setTimeout(()=>controller.abort(),8000);
  const names=[];
  try {
    // Shopify may keep a country-excluded line in the cart until checkout.
    // Read its native localized product availability; never silently remove it.
    const byHandle=new Map();for(const item of cart.items){if(!byHandle.has(item.handle))byHandle.set(item.handle,[]);byHandle.get(item.handle).push(item);}
    for(const [handle,items] of byHandle){
      const response=await fetch(`${context.root}products/${encodeURIComponent(handle)}.js`,{signal,headers:{Accept:'application/json'}});
      if(response.status===404){names.push(items[0].product_title);continue;}
      if(!response.ok)continue;
      const product=await response.json();
      for(const item of items)if(!product.variants?.some(v=>v.id===item.variant_id&&v.available))names.push(item.product_title);
    }
    if(signal.aborted)return;
    const notice=document.querySelector('[data-bb-market-notice]');
    if(names.length){document.getElementById('MainContent')?.prepend(notice);notice.hidden=false;notice.dataset.unavailable='true';notice.querySelector('span').textContent=`${context.strings.cartUnavailable} ${[...new Set(names)].join(', ')}`;}
    else if(notice.dataset.unavailable==='true'){notice.hidden=true;delete notice.dataset.unavailable;}
  }catch{/* A failed availability read never changes the cart or blocks checkout. */}
  finally{clearTimeout(timeout);}
}
async function reconcileMarket(){
  let before;try{before=JSON.parse(sessionStorage.getItem('bb:market-switch'));sessionStorage.removeItem('bb:market-switch');}catch{return;}
  if(!before||Date.now()-before.at>600000||(before.country===context.country&&before.locale===context.locale))return;
  const notice=document.querySelector('[data-bb-market-notice]');document.getElementById('MainContent')?.prepend(notice);
  notice.hidden=false;notice.querySelector('span').textContent=context.strings.marketChanged;
  try{const response=await fetch(`${context.root}cart.js`);if(!response.ok)return;const cart=await response.json();const now=cart.items.map(i=>({id:i.variant_id,quantity:i.quantity}));if(JSON.stringify(before.items)!==JSON.stringify(now))notice.querySelector('span').textContent=context.strings.cartChanged;await warnUnavailableItems(cart);}catch{/* The review link remains available. */}
}
reconcileMarket();
if(context.pageType==='cart'){
  const check=()=>fetch(`${context.root}cart.js`).then(r=>r.ok?r.json():null).then(cart=>cart&&warnUnavailableItems(cart)).catch(()=>{});
  check();if(typeof subscribe==='function')subscribe(PUB_SUB_EVENTS.cartUpdate,check);
}
window.BrewbenchQA=Object.freeze({exportEvents:()=>analytics?structuredClone(events):[],status:()=>({analytics,privacyReady:!!privacy,group:group(),experiment:EXPERIMENT,testTraffic}),openPrivacy:()=>{panel.hidden=false;}});
