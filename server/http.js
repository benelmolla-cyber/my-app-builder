export function allowMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader("Allow", method); res.status(405).json({ error: "Method not allowed." }); return false;
}
export function sendError(res, error, fallback = "Something went wrong.") {
  console.error(error);
  const status = Number(error?.status) || 500;
  res.status(status).json({ error: status < 500 ? error.message : fallback });
}
