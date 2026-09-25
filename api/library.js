import { requireUser, service } from "../server/supabase.js";
import { allowMethod, sendError } from "../server/http.js";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    const user = await requireUser(req);
    const { data, error } = await service().from("generations").select("id,kind,prompt,status,output_url,created_at").eq("user_id", user.id).eq("status", "succeeded").order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    res.status(200).json({ items: data });
  } catch (error) { sendError(res, error); }
}
