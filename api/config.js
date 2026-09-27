export default function handler(_req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ supabaseUrl: process.env.SUPABASE_URL || "", supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "" });
}
