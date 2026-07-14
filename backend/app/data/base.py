"""Data source abstraction.

Every data source returns a normalized pandas DataFrame so the rest of the
app (indicators, signals, backtest) never depends on where the data came
from. To add a new source (e.g. Alpha Vantage), implement `DataSource` and
return the same shape described below.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd


class DataSourceError(Exception):
    """Raised when price data cannot be fetched (bad ticker, network, etc.)."""


class DataSource(ABC):
    """Interface for anything that can supply historical daily OHLCV data.

    Implementations must return a DataFrame indexed by a timezone-naive
    DatetimeIndex (ascending) with these exact float columns:
        open, high, low, close, volume
    """

    #: Human-readable name, surfaced in the API response.
    name: str = "base"

    @abstractmethod
    def get_history(self, ticker: str, period: str = "2y") -> pd.DataFrame:
        """Return daily OHLCV history for `ticker`.

        `period` follows the yfinance convention ("1y", "2y", ...). We fetch
        2y by default so the 200-day SMA has enough lead-in to be valid for a
        full trailing year of signals.
        """
        raise NotImplementedError

    @staticmethod
    def _validate(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
        """Shared normalization/validation applied by concrete sources."""
        required = {"open", "high", "low", "close", "volume"}
        missing = required - set(df.columns)
        if missing:
            raise DataSourceError(
                f"Data for '{ticker}' missing columns: {sorted(missing)}"
            )
        df = df.dropna(subset=["close"]).copy()
        if df.empty:
            raise DataSourceError(f"No price data returned for '{ticker}'.")
        df.index = pd.to_datetime(df.index).tz_localize(None)
        return df.sort_index()
