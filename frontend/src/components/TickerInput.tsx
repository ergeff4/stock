import { useState } from "react";

const EXAMPLES = ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"];

interface Props {
  onSubmit: (ticker: string) => void;
  loading: boolean;
}

export default function TickerInput({ onSubmit, loading }: Props) {
  const [value, setValue] = useState("");

  const submit = (ticker: string) => {
    const t = ticker.trim().toUpperCase();
    if (t) onSubmit(t);
  };

  return (
    <div className="card">
      <h2>Analyze a Stock</h2>
      <form
        className="ticker-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <input
          aria-label="Stock ticker symbol"
          placeholder="Enter a ticker, e.g. AAPL"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading || !value.trim()}>
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>
      <div className="examples">
        Try:{" "}
        {EXAMPLES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setValue(t);
              submit(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
