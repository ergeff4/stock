import type { AnalysisResponse } from "./types";

export async function analyzeTicker(ticker: string): Promise<AnalysisResponse> {
  const res = await fetch(`/api/analyze/${encodeURIComponent(ticker.trim())}`);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.json();
}
