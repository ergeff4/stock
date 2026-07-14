import type { IndicatorSignal } from "../types";

function tone(score: number): { cls: string; label: string } {
  if (score > 0.1) return { cls: "bull", label: "Bullish" };
  if (score < -0.1) return { cls: "bear", label: "Bearish" };
  return { cls: "neutral", label: "Neutral" };
}

function formatValues(values: Record<string, number>): string {
  return Object.entries(values)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  ·  ");
}

export default function IndicatorBreakdown({
  indicators,
}: {
  indicators: IndicatorSignal[];
}) {
  return (
    <div className="card">
      <h2>Indicator Breakdown</h2>
      <div className="indicator-grid">
        {indicators.map((ind) => {
          const t = tone(ind.score);
          return (
            <div className="indicator-item" key={ind.key}>
              <p className="label">{ind.label}</p>
              <div className="state">
                {/* dot + text label so state is never color-only */}
                <span className={`dot ${t.cls}`} aria-hidden="true" />
                {ind.state}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  ({t.label})
                </span>
              </div>
              <p className="values">{formatValues(ind.values)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
