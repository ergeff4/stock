"""Unit tests for indicators against known/synthetic data."""
import numpy as np
import pandas as pd

from app.indicators.bollinger import BollingerBands
from app.indicators.macd import MACD
from app.indicators.rsi import RSI
from app.indicators.sma import MovingAverageCross


def _close_df(values) -> pd.DataFrame:
    idx = pd.date_range("2023-01-01", periods=len(values), freq="B")
    close = pd.Series(values, index=idx, dtype=float)
    return pd.DataFrame(
        {"open": close, "high": close, "low": close, "close": close, "volume": 1}
    )


def test_rsi_all_gains_is_100():
    df = _close_df(np.arange(1, 60))  # monotonically increasing
    sig = RSI().evaluate(df)
    assert sig is not None
    assert sig.values["rsi"] > 99  # near 100 for pure uptrend
    assert sig.state == "Overbought"


def test_rsi_all_losses_is_low():
    df = _close_df(np.arange(60, 1, -1))  # monotonically decreasing
    sig = RSI().evaluate(df)
    assert sig.values["rsi"] < 1
    assert sig.state == "Oversold"
    assert sig.score > 0  # oversold is a bullish (positive) reading


def test_rsi_bounds_stay_in_range(uptrend_df):
    ind = RSI()
    df = ind.compute(uptrend_df)
    rsi = df["rsi"].dropna()
    assert (rsi >= 0).all() and (rsi <= 100).all()


def test_sma_golden_cross_in_uptrend(uptrend_df):
    sig = MovingAverageCross(short=50, long=200).evaluate(uptrend_df)
    assert sig is not None
    assert sig.score > 0  # bullish in a sustained uptrend
    assert sig.state in {"Golden Cross", "Uptrend"}


def test_sma_downtrend_is_bearish(downtrend_df):
    sig = MovingAverageCross(short=50, long=200).evaluate(downtrend_df)
    assert sig.score < 0
    assert sig.state in {"Death Cross", "Downtrend"}


def test_sma_needs_enough_history():
    df = _close_df(np.arange(1, 100))  # < 200 rows, SMA200 never valid
    assert MovingAverageCross(short=50, long=200).evaluate(df) is None


def test_macd_matches_manual_ema():
    df = _close_df(100 + np.sin(np.linspace(0, 12, 200)) * 5)
    out = MACD().compute(df)
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    expected = (ema12 - ema26).iloc[-1]
    assert abs(out["macd"].iloc[-1] - expected) < 1e-9


def test_macd_bullish_in_uptrend(uptrend_df):
    sig = MACD().evaluate(uptrend_df)
    assert sig is not None
    assert sig.score > 0


def test_bollinger_bands_ordering(uptrend_df):
    out = BollingerBands().compute(uptrend_df).dropna(subset=["bb_upper"])
    assert (out["bb_upper"] >= out["bb_mid"]).all()
    assert (out["bb_mid"] >= out["bb_lower"]).all()


def test_bollinger_percent_b_within_bands(flat_df):
    sig = BollingerBands().evaluate(flat_df)
    assert sig is not None
    assert 0.0 <= sig.values["percent_b"] <= 1.0 or sig.state != "Within Bands"
