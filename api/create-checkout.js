import {requireUser,service} from "../server/supabase.js";
import {allowMethod,sendError} from "../server/http.js";
import {stripeClient} from "../server/stripe.js";
import {paypalReady,paypalRequest,verifyPaypalPlan} from "../server/paypal.js";

export default async function handler(req,res){
  if(!allowMethod(req,res,"POST"))return;
  try{
    const user=await requireUser(req);
    if(process.env.BILLING_PROVIDER==="paypal"){
      if(!paypalReady())throw Object.assign(new Error("Subscriptions are not ready yet. Complete PayPal setup first."),{status:503});
      await verifyPaypalPlan();
      const db=service();
      const {data:profile,error}=await db.from("profiles").select("paypal_subscription_id,paypal_subscription_status").eq("id",user.id).single();
      if(error)throw error;
      if(profile.paypal_subscription_id&&["ACTIVE","SUSPENDED"].includes(profile.paypal_subscription_status))
        throw Object.assign(new Error("You already have a subscription. Use Manage plan instead."),{status:409});
      const origin=process.env.APP_URL.replace(/\/$/,"");
      const subscription=await paypalRequest("/v1/billing/subscriptions",{method:"POST",
        requestId:`sparky-${user.id}-${Math.floor(Date.now()/600000)}`,
        body:{plan_id:process.env.PAYPAL_PLAN_ID,custom_id:user.id,application_context:{
          brand_name:"Sparky AI",shipping_preference:"NO_SHIPPING",
          return_url:`${origin}/?checkout=success`,cancel_url:`${origin}/?checkout=cancelled`
        }}});
      const approve=subscription.links?.find(link=>link.rel==="approve")?.href;
      if(!approve||!approve.startsWith("https://"))throw new Error("PayPal did not provide an approval URL.");
      const {error:saveError}=await db.from("profiles").update({paypal_subscription_id:subscription.id,
        paypal_subscription_status:"APPROVAL_PENDING"}).eq("id",user.id);
      if(saveError)throw saveError;
      return res.status(200).json({url:approve});
    }
    if(!process.env.STRIPE_PRICE_ID||!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET||!process.env.APP_URL)
      throw Object.assign(new Error("Subscriptions are not ready yet. Payment and webhook setup must be completed first."),{status:503});
    const db=service();
    const {data:profile,error}=await db.from("profiles").select("stripe_customer_id,stripe_subscription_id,stripe_subscription_status").eq("id",user.id).single();
    if(error)throw error;
    if(profile.stripe_subscription_id&&!["canceled","incomplete_expired"].includes(profile.stripe_subscription_status))
      throw Object.assign(new Error("You already have a subscription. Use Manage plan instead."),{status:409});
    const origin=process.env.APP_URL;
    const session=await stripeClient().checkout.sessions.create({
      mode:"subscription",customer:profile.stripe_customer_id||undefined,
      customer_email:profile.stripe_customer_id?undefined:user.email,
      client_reference_id:user.id,line_items:[{price:process.env.STRIPE_PRICE_ID,quantity:1}],
      success_url:`${origin}/?checkout=success`,cancel_url:`${origin}/?checkout=cancelled`,
      subscription_data:{metadata:{user_id:user.id}},metadata:{user_id:user.id}
    },{idempotencyKey:`checkout-${user.id}-${Math.floor(Date.now()/600000)}`});
    res.status(200).json({url:session.url});
  }catch(error){sendError(res,error);}
}
