// Cloudflare Pages Function: GET /api/health
export const onRequestGet = () =>
  Response.json({ status: "ok", data_source: "yahoo-finance" });
