"""Relative Strength Index (Wilder's smoothing) with overbought/oversold flags."""
from __future__ import annotations

from typing import Optional

import pandas as pd

from .base import Indicator, IndicatorSignal


class RSI(Indicator):
    key = "rsi"
    label = "RSI (14)"
    weight = 1.0

    def __init__(self, period: int = 14, overbought: float = 70, oversold: float = 30):
        self.period = period
        self.overbought = overbought
        self.oversold = oversold

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        delta = df["close"].diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        # Wilder's smoothing == EMA with alpha = 1/period.
        avg_gain = gain.ewm(alpha=1 / self.period, min_periods=self.period).mean()
        avg_loss = loss.ewm(alpha=1 / self.period, min_periods=self.period).mean()
        rs = avg_gain / avg_loss
        # When avg_loss is 0, RS is +inf and the formula yields RSI = 100.
        df["rsi"] = 100 - (100 / (1 + rs))
        return df

    def evaluate(self, df: pd.DataFrame) -> Optional[IndicatorSignal]:
        df = self.compute(df)
        valid = df.dropna(subset=["rsi"])
        if valid.empty:
            return None
        rsi = float(valid["rsi"].iloc[-1])
        values = {"rsi": round(rsi, 2)}

        if rsi <= self.oversold:
            # Oversold is a bullish mean-reversion signal.
            score = min(1.0, (self.oversold - rsi) / self.oversold + 0.5)
            return IndicatorSignal(
                self.key, self.label, score, "Oversold",
                f"RSI is {rsi:.1f}, below {self.oversold:g} (oversold) — the "
                "stock may be due for a bounce.",
                values,
            )
        if rsi >= self.overbought:
            score = -min(1.0, (rsi - self.overbought) / (100 - self.overbought) + 0.5)
            return IndicatorSignal(
                self.key, self.label, score, "Overbought",
                f"RSI is {rsi:.1f}, above {self.overbought:g} (overbought) — "
                "momentum may be overextended.",
                values,
            )
        # Neutral zone: only a faint mean-reversion lean off the 50 midline.
        # Kept small so RSI mainly speaks at the overbought/oversold extremes
        # and does not fight the trend indicators in ordinary conditions.
        score = (50 - rsi) / 50 * 0.15
        return IndicatorSignal(
            self.key, self.label, score, "Neutral",
            f"RSI is {rsi:.1f}, in the neutral {self.oversold:g}–"
            f"{self.overbought:g} range.",
            values,
        )

    def series(self, df: pd.DataFrame) -> dict:
        df = self.compute(df)
        return {"rsi": [None if pd.isna(v) else round(float(v), 2) for v in df["rsi"]]}
