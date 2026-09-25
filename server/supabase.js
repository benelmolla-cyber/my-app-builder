import { createClient } from "@supabase/supabase-js";

export function service() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase server environment is not configured.");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireUser(req) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Object.assign(new Error("Sign in required."), { status: 401 });
  const { data, error } = await service().auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Your session is invalid or expired."), { status: 401 });
  return data.user;
}
