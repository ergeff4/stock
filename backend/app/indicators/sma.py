"""Simple Moving Averages (50 & 200 day) with golden/death cross detection."""
from __future__ import annotations

from typing import Optional

import pandas as pd

from .base import Indicator, IndicatorSignal


class MovingAverageCross(Indicator):
    key = "sma_cross"
    label = "Moving Averages (50/200)"
    weight = 1.5  # crossovers are strong, slow-moving trend signals

    def __init__(self, short: int = 50, long: int = 200) -> None:
        self.short = short
        self.long = long

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["sma_short"] = df["close"].rolling(self.short).mean()
        df["sma_long"] = df["close"].rolling(self.long).mean()
        return df

    def evaluate(self, df: pd.DataFrame) -> Optional[IndicatorSignal]:
        df = self.compute(df)
        valid = df.dropna(subset=["sma_short", "sma_long"])
        if len(valid) < 2:
            return None

        prev, last = valid.iloc[-2], valid.iloc[-1]
        short_now, long_now = last["sma_short"], last["sma_long"]
        short_prev, long_prev = prev["sma_short"], prev["sma_long"]

        crossed_up = short_prev <= long_prev and short_now > long_now
        crossed_down = short_prev >= long_prev and short_now < long_now
        above = short_now > long_now

        values = {
            f"sma{self.short}": round(float(short_now), 2),
            f"sma{self.long}": round(float(long_now), 2),
        }

        if crossed_up:
            return IndicatorSignal(
                self.key, self.label, 1.0, "Golden Cross",
                f"The {self.short}-day average just crossed above the "
                f"{self.long}-day average (golden cross), a classic bullish "
                "trend signal.",
                values,
            )
        if crossed_down:
            return IndicatorSignal(
                self.key, self.label, -1.0, "Death Cross",
                f"The {self.short}-day average just crossed below the "
                f"{self.long}-day average (death cross), a classic bearish "
                "trend signal.",
                values,
            )
        if above:
            return IndicatorSignal(
                self.key, self.label, 0.4, "Uptrend",
                f"The {self.short}-day average is above the {self.long}-day "
                "average, indicating a longer-term uptrend.",
                values,
            )
        return IndicatorSignal(
            self.key, self.label, -0.4, "Downtrend",
            f"The {self.short}-day average is below the {self.long}-day "
            "average, indicating a longer-term downtrend.",
            values,
        )

    def series(self, df: pd.DataFrame) -> dict:
        df = self.compute(df)
        return {
            "sma50": _to_list(df["sma_short"]),
            "sma200": _to_list(df["sma_long"]),
        }


def _to_list(s: pd.Series) -> list:
    return [None if pd.isna(v) else round(float(v), 4) for v in s]
