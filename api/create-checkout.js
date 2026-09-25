import Stripe from "stripe";
import { requireUser, service } from "../server/supabase.js";
import { allowMethod, sendError } from "../server/http.js";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  try {
    const user = await requireUser(req);
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) throw new Error("Stripe is not configured.");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const db = service();
    const { data: profile } = await db.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    const origin = process.env.APP_URL || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", customer: profile?.stripe_customer_id || undefined,
      customer_email: profile?.stripe_customer_id ? undefined : user.email,
      client_reference_id: user.id, line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?checkout=success`, cancel_url: `${origin}/?checkout=cancelled`,
      subscription_data: { metadata: { user_id: user.id } }, metadata: { user_id: user.id }
    });
    res.status(200).json({ url: session.url });
  } catch (error) { sendError(res, error); }
}
