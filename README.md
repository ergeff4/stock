# 📈 Stock Signal Analyzer

A web app that pulls historical stock prices, computes technical indicators
(moving averages, RSI, MACD, Bollinger Bands), combines them into a plain-English
**Buy / Hold / Sell** signal, charts everything, and backtests the strategy over
the past year.

> ⚠️ **Educational technical-analysis tool — not financial advice.** Signals are
> derived from historical price patterns and can be wrong. Past performance does
> not predict future results. Nothing here is a recommendation to buy or sell any
> security.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python · FastAPI · pandas · [`yfinance`](https://pypi.org/project/yfinance/) (free, no API key) |
| Frontend | React · TypeScript · Vite · [Recharts](https://recharts.org/) |

---

## Features

- **Ticker search** → fetches ~2 years of daily prices (so the 200-day SMA is
  valid for a full trailing year of signals).
- **Indicators**, each in its own module:
  - **SMA 50 / 200** — flags golden cross / death cross
  - **RSI (14)** — flags overbought (>70) / oversold (<30)
  - **MACD (12/26/9)** — flags bullish / bearish crossovers
  - **Bollinger Bands (20, 2σ)** — flags price touching the upper / lower band
- **Composite signal** — a transparent weighted vote across indicators, with an
  explanation of *which* indicators triggered it.
- **Charts** — price with SMA + Bollinger overlays, plus stacked RSI and MACD
  panels (each on its own axis — never a dual-axis chart).
- **Backtest** — "follow the signals" vs "buy & hold" over the past year, with
  return, drawdown, win rate, and an equity curve. Hypothetical, fees excluded.
- **Always-visible disclaimer**; no profit guarantees anywhere.

---

## Run it locally

You'll need **Python 3.10+** and **Node 18+**. Use two terminals.

### 1. Backend (port 8000)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Sanity check: <http://localhost:8000/api/health> → `{"status":"ok",...}`
Try the API directly: <http://localhost:8000/api/analyze/AAPL>

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> and enter a ticker (e.g. `AAPL`). The Vite dev
server proxies `/api` to the backend on port 8000 (see `vite.config.ts`).

### Run the backend tests

```bash
cd backend
source .venv/bin/activate
pytest
```

---

## Project structure

```
backend/app/
  data/          # DataSource abstraction — swap-in point for other providers
    base.py            # interface + shared validation
    yfinance_source.py # Yahoo Finance implementation
  indicators/    # one file per indicator, all sharing a common interface
    base.py            # Indicator interface (compute + evaluate + series)
    sma.py rsi.py macd.py bollinger.py
    registry.py        # the active indicator set
  signals/
    composite.py       # weighted-vote engine -> Buy / Hold / Sell + reasons
  backtest/
    engine.py          # follow-the-signals vs buy & hold
  main.py        # FastAPI routes
  tests/         # unit tests for indicators, signals, backtest

frontend/src/
  components/    # TickerInput, SignalCard, PriceChart, IndicatorBreakdown,
                 # BacktestSummary, Disclaimer
  api.ts  types.ts  theme.css  App.tsx
```

---

## Extending it

The code is structured so you can grow it without touching the core.

### Add a new indicator

1. Create `backend/app/indicators/your_indicator.py`:

   ```python
   from .base import Indicator, IndicatorSignal

   class YourIndicator(Indicator):
       key = "your_key"
       label = "Your Indicator"
       weight = 1.0

       def compute(self, df):
           df = df.copy()
           df["your_col"] = ...        # add your columns
           return df

       def evaluate(self, df):
           df = self.compute(df)
           # return IndicatorSignal(key, label, score[-1..1], state, reason, values)
           ...

       def series(self, df):           # optional: expose data for charting
           return {"your_col": [...]}
   ```

2. Register it in `backend/app/indicators/registry.py`:

   ```python
   from .your_indicator import YourIndicator
   INDICATORS = [..., YourIndicator()]
   ```

That's it — the composite signal, backtest, and API payload pick it up
automatically. Add a chart series in the frontend if you exposed one via
`series()`.

### Swap the data source

Implement `DataSource` (see `backend/app/data/base.py`) for your provider —
e.g. Alpha Vantage — returning the same normalized OHLCV DataFrame, then change
one line in `backend/app/main.py`:

```python
DATA_SOURCE = YFinanceSource()   # -> AlphaVantageSource(api_key=...)
```

Nothing in the indicator, signal, or backtest code needs to change.

### Tune the signal

Indicator weights live on each indicator class (`weight = ...`); the Buy/Sell
thresholds live in `backend/app/signals/composite.py`
(`BUY_THRESHOLD` / `SELL_THRESHOLD`).

---

## Notes & limitations

- The backtest is a **simple long/flat model** (fully long on Buy, cash on Sell,
  one-day execution lag). It excludes transaction costs, slippage, taxes, and
  dividends. It is a sanity check on the strategy over *past* data — **not** a
  prediction of future performance.
- `yfinance` scrapes Yahoo Finance's public endpoints; occasional rate-limiting
  or symbol quirks are expected. Retrying or switching data sources is easy given
  the abstraction above.
