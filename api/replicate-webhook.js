import {timingSafeEqual} from "node:crypto";
import {service} from "../server/supabase.js";
import {finishGeneration} from "../server/jobs.js";

export const config={maxDuration:300};
function validSecret(value){const expected=process.env.REPLICATE_WEBHOOK_SECRET||"";const supplied=typeof value==="string"?value:"";const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length>0&&a.length===b.length&&timingSafeEqual(a,b);}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).end();
  if(!validSecret(req.query?.secret))return res.status(401).json({error:"Unauthorized."});
  const predictionId=req.body?.id;
  if(typeof predictionId!=="string")return res.status(400).json({error:"Missing prediction ID."});
  try{const {data,error}=await service().from("generations").select("id,user_id,kind,provider_prediction_id,attempt_count").eq("provider_prediction_id",predictionId).eq("status","processing").maybeSingle();if(error)throw error;if(!data)return res.status(200).json({received:true,ignored:true});const result=await finishGeneration(data);res.status(200).json({received:true,result});}catch(error){console.error("Replicate webhook error",error);res.status(500).json({error:"Webhook processing failed."});}
}
