import { requireUser, service } from "../server/supabase.js";
import { allowMethod, sendError } from "../server/http.js";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    const user = await requireUser(req);
    const { data: profile, error } = await service().from("profiles").select("credits,trial_ends_at,stripe_subscription_status").eq("id", user.id).single();
    if (error) throw error;
    const owner = process.env.OWNER_EMAIL?.toLowerCase() === user.email?.toLowerCase();
    const billingReady = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET && process.env.APP_URL);
    res.status(200).json({ user: { id: user.id, email: user.email }, profile, owner, credits: owner ? null : profile.credits, hasSubscription: ["active", "trialing", "past_due", "unpaid"].includes(profile.stripe_subscription_status), billingReady });
  } catch (error) { sendError(res, error); }
}
