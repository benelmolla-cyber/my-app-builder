import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const sql=await readFile(new URL("../supabase/schema.sql",import.meta.url),"utf8");
test("private storage has no client object policy",()=>{assert.match(sql,/values\('generated-media','generated-media',false/);assert.doesNotMatch(sql,/policy .*storage\.objects/i);});
test("reservation serializes balances and deduplicates requests",()=>{assert.match(sql,/unique\(user_id,idempotency_key\)/);assert.match(sql,/for update/);assert.match(sql,/p_kind='image' and p_cost<>1/);assert.match(sql,/p_kind='video' and p_cost<>10/);});
test("refunds are locked and idempotent",()=>{assert.match(sql,/status in \('submitting','processing'\) for update/);assert.match(sql,/credits=credits\+v_cost/);assert.match(sql,/refunded_at=now\(\)/);});
test("invoice IDs deduplicate grants and functions reject clients",()=>{assert.match(sql,/'invoice:'\|\|p_invoice_id/);assert.match(sql,/on conflict do nothing/);assert.match(sql,/credits=credits\+100/);assert.match(sql,/revoke all on function .* from public,anon,authenticated/);});
