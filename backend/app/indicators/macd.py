"""MACD (12/26/9) with bullish/bearish crossover detection."""
from __future__ import annotations

from typing import Optional

import pandas as pd

from .base import Indicator, IndicatorSignal


class MACD(Indicator):
    key = "macd"
    label = "MACD (12/26/9)"
    weight = 1.0

    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9):
        self.fast = fast
        self.slow = slow
        self.signal = signal

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        ema_fast = df["close"].ewm(span=self.fast, adjust=False).mean()
        ema_slow = df["close"].ewm(span=self.slow, adjust=False).mean()
        df["macd"] = ema_fast - ema_slow
        df["macd_signal"] = df["macd"].ewm(span=self.signal, adjust=False).mean()
        df["macd_hist"] = df["macd"] - df["macd_signal"]
        return df

    def evaluate(self, df: pd.DataFrame) -> Optional[IndicatorSignal]:
        df = self.compute(df)
        if len(df) < self.slow + self.signal:
            return None
        prev, last = df.iloc[-2], df.iloc[-1]
        macd_now, sig_now = last["macd"], last["macd_signal"]
        macd_prev, sig_prev = prev["macd"], prev["macd_signal"]

        crossed_up = macd_prev <= sig_prev and macd_now > sig_now
        crossed_down = macd_prev >= sig_prev and macd_now < sig_now
        above = macd_now > sig_now

        values = {
            "macd": round(float(macd_now), 4),
            "signal": round(float(sig_now), 4),
            "hist": round(float(last["macd_hist"]), 4),
        }

        if crossed_up:
            return IndicatorSignal(
                self.key, self.label, 0.9, "Bullish Crossover",
                "MACD just crossed above its signal line — bullish momentum "
                "shift.",
                values,
            )
        if crossed_down:
            return IndicatorSignal(
                self.key, self.label, -0.9, "Bearish Crossover",
                "MACD just crossed below its signal line — bearish momentum "
                "shift.",
                values,
            )
        if above:
            return IndicatorSignal(
                self.key, self.label, 0.35, "Bullish",
                "MACD is above its signal line, supporting upward momentum.",
                values,
            )
        return IndicatorSignal(
            self.key, self.label, -0.35, "Bearish",
            "MACD is below its signal line, supporting downward momentum.",
            values,
        )

    def series(self, df: pd.DataFrame) -> dict:
        df = self.compute(df)
        f = lambda s: [None if pd.isna(v) else round(float(v), 4) for v in s]
        return {
            "macd": f(df["macd"]),
            "macd_signal": f(df["macd_signal"]),
            "macd_hist": f(df["macd_hist"]),
        }
