"""Yahoo Finance data source (via the `yfinance` package, no API key needed)."""
from __future__ import annotations

import pandas as pd
import yfinance as yf

from .base import DataSource, DataSourceError


class YFinanceSource(DataSource):
    name = "yahoo-finance"

    def get_history(self, ticker: str, period: str = "2y") -> pd.DataFrame:
        ticker = ticker.strip().upper()
        if not ticker:
            raise DataSourceError("Ticker must not be empty.")
        try:
            raw = yf.Ticker(ticker).history(
                period=period, interval="1d", auto_adjust=True
            )
        except Exception as exc:  # network / library errors
            raise DataSourceError(
                f"Failed to fetch data for '{ticker}': {exc}"
            ) from exc

        if raw is None or raw.empty:
            raise DataSourceError(
                f"No data found for '{ticker}'. Is the symbol correct?"
            )

        raw = raw.rename(
            columns={
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume",
            }
        )
        cols = ["open", "high", "low", "close", "volume"]
        return self._validate(raw[cols], ticker)
