import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("credit reservation locks balances and enforces fixed costs", () => {
  assert.match(sql, /for update/i);
  assert.match(sql, /p_kind = 'image' and p_cost <> 1/);
  assert.match(sql, /p_kind = 'video' and p_cost <> 10/);
  assert.match(sql, /trial expired/);
});

test("failed jobs are refunded only once", () => {
  assert.match(sql, /status='processing' for update/);
  assert.match(sql, /credits=credits\+v_cost/);
  assert.match(sql, /refunded_at=now\(\)/);
});

test("Stripe credit grants are idempotent", () => {
  assert.match(sql, /credit_events\(id,user_id,amount,reason\)/);
  assert.match(sql, /on conflict do nothing/);
  assert.match(sql, /credits=credits\+100/);
});
