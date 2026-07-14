"""Shared fixtures: synthetic OHLCV data so tests need no network."""
import numpy as np
import pandas as pd
import pytest


def _ohlcv_from_close(close: pd.Series) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "open": close.shift(1).fillna(close),
            "high": close * 1.01,
            "low": close * 0.99,
            "close": close,
            "volume": 1_000_000,
        }
    )


def _trend_with_pullbacks(base: float, drift: float, seed: int) -> pd.Series:
    """A trending series with periodic pullbacks, like a real stock.

    The drift dominates over the full window (so SMA50/200 separate cleanly),
    but the sinusoidal component creates rallies/dips so oscillators like RSI
    are not permanently pinned at an extreme (which a perfectly monotonic
    series would cause).
    """
    idx = pd.date_range("2023-01-01", periods=300, freq="B")
    t = np.arange(300)
    rng = np.random.default_rng(seed)
    close = base + drift * t + 6.0 * np.sin(t / 12.0) + rng.normal(0, 0.5, 300)
    return pd.Series(close, index=idx)


@pytest.fixture
def uptrend_df() -> pd.DataFrame:
    """300 sessions trending up with realistic pullbacks."""
    return _ohlcv_from_close(_trend_with_pullbacks(100, 0.5, seed=42))


@pytest.fixture
def downtrend_df() -> pd.DataFrame:
    """300 sessions trending down with realistic rallies."""
    return _ohlcv_from_close(_trend_with_pullbacks(250, -0.5, seed=7))


@pytest.fixture
def flat_df() -> pd.DataFrame:
    idx = pd.date_range("2023-01-01", periods=300, freq="B")
    rng = np.random.default_rng(1)
    close = pd.Series(100 + rng.normal(0, 1, 300), index=idx)
    return _ohlcv_from_close(close)
