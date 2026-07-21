import type { AnalysisResponse } from "../types";

const ICON: Record<string, string> = { Buy: "▲", Hold: "■", Sell: "▼" };
const ARROW: Record<string, string> = { Buy: "↑", Hold: "→", Sell: "↓" };

interface Props {
  data: AnalysisResponse;
}

export default function SignalCard({ data }: Props) {
  const { signal, ticker, last_close, as_of } = data;
  const cls = signal.action.toLowerCase();
  const confidencePct = Math.round(signal.confidence * 100);

  // Score bar: -1 → 0 → +1, center at 50%
  const scorePct = ((signal.score + 1) / 2) * 100;
  const clampedPct = Math.max(2, Math.min(98, scorePct));

  return (
    <div className={`signal-card-banner ${cls}`}>
      {/* Big action label */}
      <div className="signal-action-block">
        <span className="signal-arrow" aria-hidden="true">{ARROW[signal.action]}</span>
        <span className="signal-action-word">{signal.action.toUpperCase()}</span>
        <span className="signal-icon-small" aria-hidden="true">{ICON[signal.action]}</span>
      </div>

      {/* Ticker + price */}
      <div className="signal-ticker-row">
        <span className="signal-ticker">{ticker}</span>
        <span className="signal-price">${last_close.toFixed(2)}</span>
        <span className="signal-asof">as of {as_of}</span>
      </div>

      {/* Summary sentence */}
      <p className="signal-summary">{signal.summary}</p>

      {/* Score bar */}
      <div className="signal-bar-wrap">
        <span className="bar-label-left">Strong Sell</span>
        <div className="signal-score-bar" role="meter" aria-valuenow={signal.score} aria-valuemin={-1} aria-valuemax={1}>
          <div className="bar-track">
            <div className="bar-fill" style={{ left: "50%", width: `${Math.abs(signal.score / 2) * 100}%`, transform: signal.score >= 0 ? "none" : "translateX(-100%)" }} />
            <div className="bar-center" />
            <div className="bar-thumb" style={{ left: `${clampedPct}%` }} />
          </div>
        </div>
        <span className="bar-label-right">Strong Buy</span>
      </div>

      {/* Score + confidence chips */}
      <div className="signal-chips">
        <span className="chip">
          Score {signal.score >= 0 ? "+" : ""}{signal.score.toFixed(2)}
        </span>
        <span className="chip">
          Confidence {confidencePct}%
        </span>
        <div className="confidence-dots">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={`conf-dot ${i < Math.round(signal.confidence * 10) ? "filled" : ""}`}
            />
          ))}
        </div>
      </div>

      {/* Reasons */}
      <ul className="signal-reasons">
        {signal.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
