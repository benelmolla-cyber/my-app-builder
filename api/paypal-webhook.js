import {service} from "../server/supabase.js";
import {paypalRequest,verifyPaypalWebhook,verifyPaypalPlan} from "../server/paypal.js";
export const config={api:{bodyParser:false}};
const readBody=req=>new Promise((resolve,reject)=>{const chunks=[];let bytes=0;
  req.on("data",part=>{bytes+=part.length;if(bytes>256000){reject(new Error("Webhook too large."));req.destroy();}else chunks.push(part);});
  req.on("end",()=>resolve(Buffer.concat(chunks)));req.on("error",reject);
});
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).end();
  if(process.env.BILLING_PROVIDER!=="paypal")return res.status(503).end();
  try{
    const event=JSON.parse((await readBody(req)).toString("utf8"));
    if(!await verifyPaypalWebhook(req.headers,event))return res.status(400).json({error:"Invalid webhook signature."});
    const type=event.event_type, resource=event.resource||{};
    const db=service();
    if(["PAYMENT.SALE.COMPLETED","PAYMENT.SALE.REFUNDED","PAYMENT.SALE.REVERSED"].includes(type)){
      const subscriptionId=resource.billing_agreement_id;
      if(!subscriptionId||!resource.id)return res.status(200).json({ignored:true});
      const sub=await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
      if(sub.plan_id!==process.env.PAYPAL_PLAN_ID||!sub.custom_id)return res.status(200).json({ignored:true});
      const {data:profile,error:profileError}=await db.from("profiles").select("id,paypal_subscription_id").eq("id",sub.custom_id).single();
      if(profileError||profile?.paypal_subscription_id!==subscriptionId)throw new Error("PayPal subscription ownership mismatch.");
      if(type==="PAYMENT.SALE.COMPLETED"){
        await verifyPaypalPlan();
        if(resource.state!=="completed"||resource.amount?.currency!=="USD"||
          resource.amount?.total!==process.env.PAYPAL_MONTHLY_PRICE||sub.status!=="ACTIVE")
          throw new Error("PayPal payment amount or subscription status mismatch.");
        const {error}=await db.rpc("apply_paypal_payment",{p_user_id:sub.custom_id,p_sale_id:resource.id,p_subscription_id:subscriptionId});
        if(error)throw error;
      }else{
        const {error}=await db.rpc("reverse_paypal_payment",{p_user_id:sub.custom_id,p_sale_id:resource.id,p_subscription_id:subscriptionId});
        if(error)throw error;
      }
    }else if(["BILLING.SUBSCRIPTION.CANCELLED","BILLING.SUBSCRIPTION.EXPIRED","BILLING.SUBSCRIPTION.SUSPENDED","BILLING.SUBSCRIPTION.ACTIVATED"].includes(type)){
      const id=resource.id;
      if(id){
        const sub=await paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
        if(sub.plan_id===process.env.PAYPAL_PLAN_ID&&sub.custom_id){
          const {error}=await db.from("profiles").update({paypal_subscription_status:sub.status}).eq("id",sub.custom_id).eq("paypal_subscription_id",id);
          if(error)throw error;
        }
      }
    }
    res.status(200).json({received:true});
  }catch(error){console.error("PayPal webhook processing failed",error);res.status(500).json({error:"Webhook processing failed."});}
}
