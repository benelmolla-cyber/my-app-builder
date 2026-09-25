import Stripe from "stripe";
import { service } from "../server/supabase.js";

export const config = { api: { bodyParser: false } };
const readBody = req => new Promise((resolve, reject) => { const parts=[]; req.on("data", c=>parts.push(c)); req.on("end",()=>resolve(Buffer.concat(parts))); req.on("error",reject); });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(await readBody(req), req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
    const db = service();
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata.user_id;
      if (!userId) throw new Error("Subscription is missing user_id metadata.");
      const { error } = await db.rpc("apply_subscription_payment", { p_user_id: userId, p_event_id: event.id, p_customer_id: String(invoice.customer), p_subscription_id: String(invoice.subscription) });
      if (error) throw error;
    }
    if (["customer.subscription.deleted", "customer.subscription.updated"].includes(event.type)) {
      const sub = event.data.object;
      if (sub.metadata.user_id) await db.from("profiles").update({ stripe_subscription_status: sub.status }).eq("id", sub.metadata.user_id);
    }
    res.status(200).json({ received: true });
  } catch (error) { console.error("Stripe webhook error", error); res.status(400).json({ error: "Invalid webhook." }); }
}
