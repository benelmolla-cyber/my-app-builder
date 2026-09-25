import {requireUser,service} from "../server/supabase.js";
import {allowMethod,sendError} from "../server/http.js";
import {stripeClient} from "../server/stripe.js";
export default async function handler(req,res){if(!allowMethod(req,res,"POST"))return;try{const user=await requireUser(req);const {data,error}=await service().from("profiles").select("stripe_customer_id").eq("id",user.id).single();if(error)throw error;if(!data.stripe_customer_id)throw Object.assign(new Error("No subscription to manage."),{status:404});const origin=process.env.APP_URL||`https://${req.headers.host}`;const session=await stripeClient().billingPortal.sessions.create({customer:data.stripe_customer_id,return_url:origin});res.status(200).json({url:session.url});}catch(error){sendError(res,error);}}
