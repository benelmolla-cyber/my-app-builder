import test from "node:test";
import assert from "node:assert/strict";
const enabled=process.env.SUPABASE_TEST_URL&&process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
test("database permissions, concurrent charges, refunds, and duplicate invoices",{skip:!enabled},async()=>{
  const {createClient}=await import("@supabase/supabase-js");
  const admin=createClient(process.env.SUPABASE_TEST_URL,process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,{auth:{persistSession:false}});const email=`sparky-test-${Date.now()}@example.com`;const {data:created,error:createError}=await admin.auth.admin.createUser({email,password:crypto.randomUUID(),email_confirm:true});assert.ifError(createError);const id=created.user.id;
  try{
    const anon=createClient(process.env.SUPABASE_TEST_URL,process.env.SUPABASE_TEST_ANON_KEY,{auth:{persistSession:false}});const denied=await anon.rpc("reserve_generation",{p_user_id:id,p_idempotency_key:crypto.randomUUID(),p_kind:"image",p_prompt:"x",p_aspect_ratio:"1:1",p_cost:1,p_is_owner:false});assert.ok(denied.error,"anon must not reserve credits");
    const duplicateKey=crypto.randomUUID();const duplicates=await Promise.all(Array.from({length:5},()=>admin.rpc("reserve_generation",{p_user_id:id,p_idempotency_key:duplicateKey,p_kind:"image",p_prompt:"same",p_aspect_ratio:"1:1",p_cost:1,p_is_owner:false})));assert.equal(new Set(duplicates.map(x=>x.data[0].generation_id)).size,1);assert.equal(duplicates.filter(x=>x.data[0].created).length,1);
    const keys=Array.from({length:20},()=>crypto.randomUUID());const attempts=await Promise.all(keys.map(key=>admin.rpc("reserve_generation",{p_user_id:id,p_idempotency_key:key,p_kind:"image",p_prompt:"x",p_aspect_ratio:"1:1",p_cost:1,p_is_owner:false})));assert.equal(attempts.filter(x=>!x.error).length,11);const {data:profile}=await admin.from("profiles").select("credits").eq("id",id).single();assert.equal(profile.credits,0);
    const job=attempts.find(x=>!x.error).data[0].generation_id;const first=await admin.rpc("fail_and_refund_generation",{p_generation_id:job,p_reason:"test"});const second=await admin.rpc("fail_and_refund_generation",{p_generation_id:job,p_reason:"test again"});assert.equal(first.data,true);assert.equal(second.data,false);
    await admin.rpc("apply_subscription_payment",{p_user_id:id,p_invoice_id:"in_test",p_customer_id:`cus_${id}`,p_subscription_id:`sub_${id}`});await admin.rpc("apply_subscription_payment",{p_user_id:id,p_invoice_id:"in_test",p_customer_id:`cus_${id}`,p_subscription_id:`sub_${id}`});const {data:after}=await admin.from("profiles").select("credits").eq("id",id).single();assert.equal(after.credits,101);
  }finally{await admin.auth.admin.deleteUser(id);}
});
