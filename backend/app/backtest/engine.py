"""Simple long/flat backtest that follows the composite signal.

Strategy rules (deliberately simple and transparent):
  * Buy  -> be fully long the next day.
  * Sell -> move to cash (flat) the next day.
  * Hold -> keep whatever position you currently hold.

Signals are acted on with a one-day lag (you can only trade *after* a
signal prints), so this does not peek at same-day information. Results are
compared against buy-and-hold.

This is a HYPOTHETICAL sanity check on the strategy over past data. It is
not a prediction and past performance does not indicate future results.
Transaction costs and slippage are not modeled.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

import pandas as pd

from ..signals.composite import evaluate as evaluate_signal


@dataclass
class Trade:
    date: str
    action: str
    price: float


@dataclass
class BacktestResult:
    equity_curve: List[dict] = field(default_factory=list)   # date, strategy, buy_hold
    trades: List[Trade] = field(default_factory=list)
    strategy_return_pct: float = 0.0
    buy_hold_return_pct: float = 0.0
    max_drawdown_pct: float = 0.0
    num_trades: int = 0
    win_rate_pct: float = 0.0
    days_in_market_pct: float = 0.0


def run_backtest(df: pd.DataFrame, lookback_days: int = 252) -> BacktestResult:
    """Walk forward over the trailing `lookback_days` trading days.

    We need history *before* the window so indicators (esp. the 200-day SMA)
    are warmed up, so `df` should contain more than `lookback_days` rows.
    """
    if len(df) < 30:
        return BacktestResult()

    start_idx = max(1, len(df) - lookback_days)

    # Precompute the signal action for each day in the window using the same
    # composite engine the live view uses (single source of truth).
    actions: List[str] = []
    for i in range(start_idx, len(df)):
        window = df.iloc[: i + 1]
        actions.append(evaluate_signal(window).action)

    window_df = df.iloc[start_idx:].copy()
    window_df["action"] = actions

    strat_equity = 1.0
    hold_equity = 1.0
    position = 0            # 0 = flat, 1 = long
    prev_close = float(window_df["close"].iloc[0])
    base_close = prev_close

    curve: List[dict] = []
    trades: List[Trade] = []
    days_long = 0
    trade_entry_price = None
    wins = 0
    closed_trades = 0

    for date, row in window_df.iterrows():
        close = float(row["close"])
        daily_ret = (close / prev_close) - 1.0

        # Apply the position we were holding coming into today.
        if position == 1:
            strat_equity *= 1.0 + daily_ret
            days_long += 1
        hold_equity = close / base_close

        # Decide tomorrow's position from today's signal (acted next bar).
        action = row["action"]
        new_position = position
        if action == "Buy":
            new_position = 1
        elif action == "Sell":
            new_position = 0

        if new_position != position:
            trades.append(Trade(date.strftime("%Y-%m-%d"), action, round(close, 2)))
            if new_position == 1:                 # entering long
                trade_entry_price = close
            elif position == 1 and trade_entry_price is not None:  # exiting long
                closed_trades += 1
                if close > trade_entry_price:
                    wins += 1
                trade_entry_price = None
            position = new_position

        curve.append(
            {
                "date": date.strftime("%Y-%m-%d"),
                "strategy": round((strat_equity - 1.0) * 100, 2),
                "buy_hold": round((hold_equity - 1.0) * 100, 2),
            }
        )
        prev_close = close

    # If we ended still holding, count it as a closed trade for win-rate.
    if position == 1 and trade_entry_price is not None:
        closed_trades += 1
        if prev_close > trade_entry_price:
            wins += 1

    max_dd = _max_drawdown([c["strategy"] for c in curve])
    n = len(window_df)

    return BacktestResult(
        equity_curve=curve,
        trades=trades,
        strategy_return_pct=round((strat_equity - 1.0) * 100, 2),
        buy_hold_return_pct=round((hold_equity - 1.0) * 100, 2),
        max_drawdown_pct=round(max_dd, 2),
        num_trades=len(trades),
        win_rate_pct=round((wins / closed_trades * 100) if closed_trades else 0.0, 1),
        days_in_market_pct=round((days_long / n * 100) if n else 0.0, 1),
    )


def _max_drawdown(pct_curve: List[float]) -> float:
    """Largest peak-to-trough drop of the strategy equity, in percent."""
    peak = float("-inf")
    max_dd = 0.0
    for pct in pct_curve:
        equity = 1.0 + pct / 100.0
        peak = max(peak, equity)
        if peak > 0:
            dd = (equity - peak) / peak * 100.0
            max_dd = min(max_dd, dd)
    return max_dd
