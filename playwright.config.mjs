import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'tests/browser',fullyParallel:false,workers:1,retries:0,maxFailures:1,timeout:60000,
 expect:{timeout:15000},outputDir:'.local/playwright/results',
 reporter:[['list'],['json',{outputFile:'.local/playwright/report.json'}],['html',{outputFolder:'.local/playwright/report',open:'never'}]],
 use:{baseURL:process.env.SHOPIFY_BASE_URL||'https://brewbench-practice.myshopify.com',storageState:'.local/playwright/auth.json',trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
 projects:[
  {name:'setup',testMatch:/auth\.setup\.mjs/,use:{storageState:{cookies:[],origins:[]},trace:'off',screenshot:'off'}},
  {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}},dependencies:['setup'],testMatch:/storefront\.spec\.mjs/},
  {name:'chromium-mobile',use:{...devices['Pixel 7']},dependencies:['setup'],testMatch:/storefront\.spec\.mjs/},
  {name:'firefox-desktop',use:{...devices['Desktop Firefox']},dependencies:['setup'],testMatch:/storefront\.spec\.mjs/},
  {name:'webkit-desktop',use:{...devices['Desktop Safari']},dependencies:['setup'],testMatch:/storefront\.spec\.mjs/},
 ]
});
