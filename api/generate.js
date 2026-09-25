import { requireUser, service } from "../server/supabase.js";
import { runGeneration } from "../server/provider.js";
import { allowMethod, sendError } from "../server/http.js";

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  let reservation;
  try {
    const user = await requireUser(req);
    const { type, prompt, aspectRatio = "1:1" } = req.body || {};
    if (!['image', 'video'].includes(type)) throw Object.assign(new Error("Choose image or video."), { status: 400 });
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 1500) {
      throw Object.assign(new Error("Prompt must be between 1 and 1,500 characters."), { status: 400 });
    }
    const cost = type === "video" ? 10 : 1;
    const owner = process.env.OWNER_EMAIL?.toLowerCase() === user.email?.toLowerCase();
    const db = service();
    const { data, error } = await db.rpc("reserve_generation", {
      p_user_id: user.id, p_kind: type, p_prompt: prompt.trim(), p_cost: cost, p_is_owner: owner
    });
    if (error) throw Object.assign(new Error(error.message), { status: /(credits|trial expired)/i.test(error.message) ? 402 : 500 });
    reservation = { id: data, userId: user.id, cost, owner };

    const outputUrl = await runGeneration({ type, prompt: prompt.trim(), aspectRatio });
    const { error: saveError } = await db.from("generations").update({ status: "succeeded", output_url: outputUrl }).eq("id", data).eq("user_id", user.id);
    if (saveError) throw saveError;
    return res.status(200).json({ generation: { id: data, type, prompt: prompt.trim(), outputUrl, status: "succeeded" }, cost: owner ? 0 : cost });
  } catch (error) {
    if (reservation) {
      const { error: refundError } = await service().rpc("fail_and_refund_generation", {
        p_generation_id: reservation.id, p_user_id: reservation.userId, p_reason: String(error.message).slice(0, 500)
      });
      if (refundError) console.error("Credit refund failed", refundError);
    }
    return sendError(res, error, "Generation failed. Any reserved credits were refunded.");
  }
}
