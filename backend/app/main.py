"""FastAPI application exposing stock analysis endpoints.

Endpoints
  GET /api/health                 -> liveness check
  GET /api/analyze/{ticker}       -> price history, indicators, composite
                                     signal, and a 1-year backtest

DISCLAIMER: This service performs educational technical analysis. It is not
financial advice, and past performance does not predict future results.
"""
from __future__ import annotations

from dataclasses import asdict

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .backtest.engine import run_backtest
from .data.base import DataSourceError
from .data.yfinance_source import YFinanceSource
from .indicators.registry import all_series
from .signals.composite import evaluate as evaluate_signal

DISCLAIMER = (
    "This tool provides educational technical analysis only. It is not "
    "financial advice, and past performance does not predict future results. "
    "Do your own research and consult a licensed professional before investing."
)

app = FastAPI(title="Stock Signal Analyzer", version="1.0.0")

# Vite dev server default origin; adjust for your deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Swap this line to change data providers app-wide.
DATA_SOURCE = YFinanceSource()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "data_source": DATA_SOURCE.name}


@app.get("/api/analyze/{ticker}")
def analyze(
    ticker: str,
    period: str = Query("2y", pattern="^(1y|2y|5y|max)$"),
) -> dict:
    """Full analysis payload for a single ticker."""
    try:
        df = DATA_SOURCE.get_history(ticker, period=period)
    except DataSourceError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if len(df) < 60:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough price history for '{ticker.upper()}' to analyze.",
        )

    signal = evaluate_signal(df)
    backtest = run_backtest(df, lookback_days=252)
    series = all_series(df)

    # Trim the returned price series to the trailing year for a tidy chart,
    # but indicators were computed on the full history (so SMA200 is valid).
    price_rows = _price_rows(df, series, tail=252)

    return {
        "ticker": ticker.upper(),
        "data_source": DATA_SOURCE.name,
        "as_of": df.index[-1].strftime("%Y-%m-%d"),
        "last_close": round(float(df["close"].iloc[-1]), 2),
        "signal": {
            "action": signal.action,
            "score": signal.score,
            "confidence": signal.confidence,
            "summary": signal.summary,
            "reasons": signal.reasons,
        },
        "indicators": [asdict(s) for s in signal.indicators],
        "chart": price_rows,
        "backtest": {
            "equity_curve": backtest.equity_curve,
            "trades": [asdict(t) for t in backtest.trades],
            "strategy_return_pct": backtest.strategy_return_pct,
            "buy_hold_return_pct": backtest.buy_hold_return_pct,
            "max_drawdown_pct": backtest.max_drawdown_pct,
            "num_trades": backtest.num_trades,
            "win_rate_pct": backtest.win_rate_pct,
            "days_in_market_pct": backtest.days_in_market_pct,
        },
        "disclaimer": DISCLAIMER,
    }


def _price_rows(df: pd.DataFrame, series: dict, tail: int) -> list:
    """Zip price + indicator series into per-date rows for the frontend chart."""
    n = len(df)
    start = max(0, n - tail)
    rows = []
    for i in range(start, n):
        date = df.index[i]
        row = {
            "date": date.strftime("%Y-%m-%d"),
            "close": round(float(df["close"].iloc[i]), 2),
        }
        for name, values in series.items():
            row[name] = values[i]
        rows.append(row)
    return rows
