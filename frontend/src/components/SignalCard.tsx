import type { AnalysisResponse } from "../types";

const ICON: Record<string, string> = { Buy: "▲", Hold: "■", Sell: "▼" };

interface Props {
  data: AnalysisResponse;
}

export default function SignalCard({ data }: Props) {
  const { signal, ticker, last_close, as_of } = data;
  const cls = signal.action.toLowerCase();

  return (
    <div className="card">
      <h2>Current Signal</h2>
      <div className="signal-hero">
        {/* Status color is paired with an icon + text label, never color alone. */}
        <span className={`signal-badge ${cls}`}>
          <span aria-hidden="true">{ICON[signal.action]}</span>
          {signal.action}
        </span>
        <div className="signal-meta">
          <p className="summary">{signal.summary}</p>
          <p className="score">
            {ticker} · ${last_close.toFixed(2)} · as of {as_of} · composite score{" "}
            {signal.score >= 0 ? "+" : ""}
            {signal.score.toFixed(2)} · confidence{" "}
            {Math.round(signal.confidence * 100)}%
          </p>
        </div>
      </div>
      <ul className="reasons">
        {signal.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
