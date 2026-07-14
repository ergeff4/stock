// Cloudflare Pages Function: GET /api/analyze/:ticker
import { buildAnalysis, HttpError } from "../../_lib/analysis";

export const onRequestGet = async (context: { params: { ticker: string } }) => {
  const ticker = context.params.ticker;
  try {
    const payload = await buildAnalysis(String(ticker));
    return Response.json(payload, {
      headers: {
        // Cache successful analyses briefly at the edge (daily bars change slowly).
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const detail = e instanceof Error ? e.message : "Unexpected error.";
    return Response.json({ detail }, { status });
  }
};
