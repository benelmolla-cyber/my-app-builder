import test from "node:test";
import assert from "node:assert/strict";
import {paypalReady,verifyPaypalWebhook,verifyPaypalPlan} from "../server/paypal.js";

test("billing stays disabled until every PayPal credential and amount is present",()=>{
  const keys=["PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET","PAYPAL_PLAN_ID","PAYPAL_WEBHOOK_ID","PAYPAL_MONTHLY_PRICE","APP_URL"];
  const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    for(const key of keys)process.env[key]="test";
    assert.equal(paypalReady(),true);
    delete process.env.PAYPAL_WEBHOOK_ID;
    assert.equal(paypalReady(),false);
  }finally{for(const key of keys)old[key]===undefined?delete process.env[key]:process.env[key]=old[key];}
});

test("unsigned PayPal webhooks fail before calling PayPal",async()=>{
  assert.equal(await verifyPaypalWebhook({}, {event_type:"PAYMENT.SALE.COMPLETED"}),false);
});

test("PayPal plan must match monthly USD price",async()=>{
  const old=Object.fromEntries(["PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET","PAYPAL_PLAN_ID","PAYPAL_MONTHLY_PRICE"].map(k=>[k,process.env[k]]));
  const previousFetch=globalThis.fetch;
  try{
    Object.assign(process.env,{PAYPAL_CLIENT_ID:"id",PAYPAL_CLIENT_SECRET:"secret",PAYPAL_PLAN_ID:"P-123",PAYPAL_MONTHLY_PRICE:"14.99"});
    globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes("/oauth2/token")?{access_token:"test"}:
      {status:"ACTIVE",billing_cycles:[{tenure_type:"REGULAR",frequency:{interval_unit:"MONTH",interval_count:1},
        total_cycles:0,pricing_scheme:{fixed_price:{currency_code:"USD",value:"14.99"}}}]}});
    await verifyPaypalPlan();
    process.env.PAYPAL_MONTHLY_PRICE="1.00";
    await assert.rejects(verifyPaypalPlan(),/must be active and match/);
  }finally{
    globalThis.fetch=previousFetch;
    for(const [key,value] of Object.entries(old))value===undefined?delete process.env[key]:process.env[key]=value;
  }
});
