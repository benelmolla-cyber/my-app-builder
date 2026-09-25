import {service} from "./supabase.js";
import {getPrediction,outputUrl} from "./provider.js";

const TERMINAL=new Set(["succeeded","failed","canceled"]);
export async function finishGeneration(job,{fetcher=fetch}={}){
  const db=service();
  try{
    const prediction=await getPrediction(job.provider_prediction_id,{fetcher});
    if(!TERMINAL.has(prediction.status))return "pending";
    if(prediction.status!=="succeeded"){await db.rpc("fail_and_refund_generation",{p_generation_id:job.id,p_reason:prediction.error||`Provider job ${prediction.status}.`});return "failed";}
    const source=await fetcher(outputUrl(prediction)); if(!source.ok)throw new Error("Could not copy provider output.");
    const contentType=(source.headers.get("content-type")||"").split(";")[0]; const allowed=job.kind==="image"?["image/webp","image/png","image/jpeg"]:["video/mp4","video/webm"];
    if(!allowed.includes(contentType)){await db.rpc("fail_and_refund_generation",{p_generation_id:job.id,p_reason:"Provider returned an unsupported media type."});return "failed";}
    const extension=contentType.split("/")[1].replace("jpeg","jpg"); const path=`${job.user_id}/${job.id}.${extension}`; const body=await source.arrayBuffer();
    const {error:uploadError}=await db.storage.from("generated-media").upload(path,body,{contentType,upsert:false}); if(uploadError&&!/already exists/i.test(uploadError.message))throw uploadError;
    const {error:updateError}=await db.from("generations").update({status:"succeeded",storage_path:path,mime_type:contentType,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","processing"); if(updateError)throw updateError;
    return "succeeded";
  }catch(error){const attempts=(job.attempt_count||0)+1;if(attempts>=3){await db.rpc("fail_and_refund_generation",{p_generation_id:job.id,p_reason:`Recovery failed after ${attempts} attempts: ${error.message}`});return "failed";}await db.from("generations").update({attempt_count:attempts,error:String(error.message).slice(0,500)}).eq("id",job.id).eq("status","processing");return "retry";}
}
export async function recoverJobs({now=new Date(),fetcher=fetch}={}){
  const db=service(); const staleSubmitting=new Date(now.getTime()-5*60_000).toISOString(); const timedOut=new Date(now.getTime()-30*60_000).toISOString();
  const {data:orphans=[]}=await db.from("generations").select("id").eq("status","submitting").lt("updated_at",staleSubmitting).limit(50);
  for(const job of orphans)await db.rpc("fail_and_refund_generation",{p_generation_id:job.id,p_reason:"Submission recovery timeout; no provider job was recorded."});
  const {data:expired=[]}=await db.from("generations").select("id").eq("status","processing").lt("updated_at",timedOut).limit(50);
  for(const job of expired)await db.rpc("fail_and_refund_generation",{p_generation_id:job.id,p_reason:"Generation exceeded the 30 minute processing limit."});
  const {data:jobs=[],error}=await db.from("generations").select("id,user_id,kind,provider_prediction_id,attempt_count").eq("status","processing").gte("updated_at",timedOut).limit(20); if(error)throw error;
  const results=[]; for(const job of jobs)results.push(await finishGeneration(job,{fetcher})); return {checked:jobs.length,results};
}
