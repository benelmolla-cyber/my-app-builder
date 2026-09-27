import test from "node:test";
import assert from "node:assert/strict";
import {invoiceSubscriptionId,STRIPE_API_VERSION} from "../server/stripe-shapes.js";
test("Stripe API is pinned to the Basil shape used by stripe 18.5.0",()=>{assert.equal(STRIPE_API_VERSION,"2025-06-30.basil");assert.equal(invoiceSubscriptionId({parent:{subscription_details:{subscription:"sub_new"}}}),"sub_new");});
test("legacy-version webhook retries still resolve subscription IDs",()=>{assert.equal(invoiceSubscriptionId({subscription:"sub_old"}),"sub_old");assert.equal(invoiceSubscriptionId({subscription:{id:"sub_expanded"}}),"sub_expanded");});
