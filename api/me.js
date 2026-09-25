import { requireUser, service } from "../server/supabase.js";
import { allowMethod, sendError } from "../server/http.js";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    const user = await requireUser(req);
    const { data: profile, error } = await service().from("profiles").select("credits,trial_ends_at,stripe_subscription_status").eq("id", user.id).single();
    if (error) throw error;
    const owner = process.env.OWNER_EMAIL?.toLowerCase() === user.email?.toLowerCase();
    res.status(200).json({ user: { id: user.id, email: user.email }, profile, owner, credits: owner ? null : profile.credits });
  } catch (error) { sendError(res, error); }
}
