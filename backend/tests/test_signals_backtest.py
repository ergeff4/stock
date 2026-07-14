"""Tests for the composite signal engine and the backtest.

We avoid asserting a signal direction from a single bar of a smoothly
oscillating series (the reading legitimately depends on where price sits in
its cycle). Instead we test:
  * structural guarantees (bounds, valid action, always explains itself),
  * unambiguous constructed scenarios (buy-the-dip, sell-the-rip),
  * that the composite never *fights* a strong trend outright.
"""
import numpy as np
import pandas as pd

from app.backtest.engine import run_backtest
from app.signals.composite import evaluate as evaluate_signal
from tests.conftest import _ohlcv_from_close


def _series(values) -> pd.DataFrame:
    idx = pd.date_range("2023-01-01", periods=len(values), freq="B")
    return _ohlcv_from_close(pd.Series(values, index=idx))


def test_composite_structure(flat_df):
    sig = evaluate_signal(flat_df)
    assert -1.0 <= sig.score <= 1.0
    assert 0.0 <= sig.confidence <= 1.0
    assert sig.action in {"Buy", "Hold", "Sell"}
    assert sig.reasons  # always explains itself
    assert sig.summary


def test_buy_the_dip_scenario():
    """Uptrend regime + a sharp end-of-window dip -> Buy."""
    up = 100 + np.arange(260) * 0.6
    dip = up[-1] - np.arange(1, 11) * 4.0
    sig = evaluate_signal(_series(np.concatenate([up, dip])))
    assert sig.action == "Buy"
    assert sig.score > 0


def test_sell_the_rip_scenario():
    """Downtrend regime + a sharp end-of-window spike -> Sell."""
    down = 250 - np.arange(260) * 0.6
    spike = down[-1] + np.arange(1, 11) * 4.0
    sig = evaluate_signal(_series(np.concatenate([down, spike])))
    assert sig.action == "Sell"
    assert sig.score < 0


def test_composite_does_not_fight_strong_uptrend(uptrend_df):
    """A healthy uptrend should never produce an outright Sell."""
    assert evaluate_signal(uptrend_df).action in {"Buy", "Hold"}


def test_composite_does_not_fight_strong_downtrend(downtrend_df):
    assert evaluate_signal(downtrend_df).action in {"Sell", "Hold"}


def test_backtest_produces_curve(uptrend_df):
    result = run_backtest(uptrend_df, lookback_days=100)
    assert len(result.equity_curve) > 0
    assert 0.0 <= result.days_in_market_pct <= 100.0
    assert result.max_drawdown_pct <= 0.0  # drawdown is negative or zero
    for point in result.equity_curve:
        assert "strategy" in point and "buy_hold" in point


def test_backtest_handles_short_history(flat_df):
    result = run_backtest(flat_df.iloc[:20])
    assert result.num_trades == 0
    assert result.equity_curve == []
