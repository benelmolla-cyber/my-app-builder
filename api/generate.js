import {randomUUID} from "node:crypto";
import {requireUser,service} from "../server/supabase.js";
import {createPrediction} from "../server/provider.js";
import {allowMethod,sendError} from "../server/http.js";

export const config={maxDuration:30};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
  if(req.method==="GET")return getStatus(req,res);
  if(!allowMethod(req,res,"POST"))return;
  let generationId,created=false;
  try{
    const user=await requireUser(req); const {type,prompt,aspectRatio="1:1"}=req.body||{};
    const key=req.headers["idempotency-key"];
    if(typeof key!=="string"||!UUID.test(key))throw Object.assign(new Error("A UUID Idempotency-Key header is required."),{status:400});
    if(!["image","video"].includes(type)||!["1:1","16:9","9:16"].includes(aspectRatio))throw Object.assign(new Error("Invalid generation options."),{status:400});
    if(typeof prompt!=="string"||!prompt.trim()||prompt.length>1500)throw Object.assign(new Error("Prompt must be between 1 and 1,500 characters."),{status:400});
    const owner=process.env.OWNER_EMAIL?.toLowerCase()===user.email?.toLowerCase(); const db=service();
    const {data,error}=await db.rpc("reserve_generation",{p_user_id:user.id,p_idempotency_key:key,p_kind:type,p_prompt:prompt.trim(),p_aspect_ratio:aspectRatio,p_cost:type==="video"?10:1,p_is_owner:owner});
    if(error)throw Object.assign(new Error(error.message),{status:/(credits|subscription required)/i.test(error.message)?402:500});
    const row=Array.isArray(data)?data[0]:data; generationId=row.generation_id; created=row.created;
    if(!created)return res.status(202).json({generation:{id:generationId,status:row.generation_status},replayed:true});
    const prediction=await createPrediction({type,prompt:prompt.trim(),aspectRatio,idempotencyKey:key});
    const {error:saveError}=await db.from("generations").update({provider_prediction_id:prediction.id,status:"processing",updated_at:new Date().toISOString()}).eq("id",generationId).eq("status","submitting");
    if(saveError)throw saveError;
    res.status(202).json({generation:{id:generationId,status:"processing"},replayed:false});
  }catch(error){
    if(generationId&&created)await service().rpc("fail_and_refund_generation",{p_generation_id:generationId,p_reason:String(error.message)}).catch(refund=>console.error("Refund failed",refund));
    sendError(res,error,"Generation could not be started. Reserved credits were refunded.");
  }
}
async function getStatus(req,res){
  try{const user=await requireUser(req); const id=String(req.query?.id||""); const db=service(); const {data,error}=await db.from("generations").select("id,kind,prompt,status,storage_path,error,created_at").eq("id",id).eq("user_id",user.id).single(); if(error||!data)throw Object.assign(new Error("Generation not found."),{status:404}); let downloadUrl=null; if(data.status==="succeeded")downloadUrl=`/api/media?id=${encodeURIComponent(data.id)}`; res.status(200).json({generation:{...data,storage_path:undefined,downloadUrl}});}catch(error){sendError(res,error);}
}
