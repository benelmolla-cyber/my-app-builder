const MODELS={image:"black-forest-labs/flux-schnell",video:"minimax/video-01"};
const headers=()=>({Authorization:`Bearer ${process.env.REPLICATE_API_TOKEN}`,"Content-Type":"application/json"});

function ensureToken(){if(!process.env.REPLICATE_API_TOKEN)throw new Error("REPLICATE_API_TOKEN is not configured.");}
export async function createPrediction({type,prompt,aspectRatio,idempotencyKey},{fetcher=fetch}={}){
  ensureToken();
  const input=type==="image"?{prompt,aspect_ratio:aspectRatio,num_outputs:1,output_format:"webp"}:{prompt,aspect_ratio:aspectRatio==="9:16"?"9:16":"16:9"};
  const response=await fetcher(`https://api.replicate.com/v1/models/${MODELS[type]}/predictions`,{method:"POST",headers:{...headers(),"Idempotency-Key":idempotencyKey},body:JSON.stringify({input})});
  const result=await response.json();
  if(!response.ok||!result.id)throw new Error(result.detail||result.error||"Provider rejected the request.");
  return {id:result.id,status:result.status};
}
export async function getPrediction(id,{fetcher=fetch}={}){
  ensureToken(); const response=await fetcher(`https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`,{headers:headers()}); const result=await response.json();
  if(!response.ok)throw new Error(result.detail||result.error||"Could not read provider job."); return result;
}
export function outputUrl(prediction){const value=Array.isArray(prediction.output)?prediction.output[0]:prediction.output; if(typeof value!=="string"||!/^https:\/\//.test(value))throw new Error("Provider returned no secure media URL.");return value;}
