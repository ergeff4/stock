"""Bollinger Bands (20-day SMA +/- 2 std) with band-touch detection."""
from __future__ import annotations

from typing import Optional

import pandas as pd

from .base import Indicator, IndicatorSignal


class BollingerBands(Indicator):
    key = "bollinger"
    label = "Bollinger Bands (20, 2σ)"
    weight = 1.0

    def __init__(self, period: int = 20, num_std: float = 2.0):
        self.period = period
        self.num_std = num_std

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        mid = df["close"].rolling(self.period).mean()
        std = df["close"].rolling(self.period).std()
        df["bb_mid"] = mid
        df["bb_upper"] = mid + self.num_std * std
        df["bb_lower"] = mid - self.num_std * std
        return df

    def evaluate(self, df: pd.DataFrame) -> Optional[IndicatorSignal]:
        df = self.compute(df)
        valid = df.dropna(subset=["bb_upper", "bb_lower"])
        if valid.empty:
            return None
        last = valid.iloc[-1]
        close = float(last["close"])
        upper, lower, mid = (
            float(last["bb_upper"]),
            float(last["bb_lower"]),
            float(last["bb_mid"]),
        )
        # %B: position within the bands (0 = lower, 1 = upper).
        width = upper - lower
        pct_b = (close - lower) / width if width else 0.5
        values = {
            "upper": round(upper, 2),
            "lower": round(lower, 2),
            "mid": round(mid, 2),
            "percent_b": round(pct_b, 3),
        }

        if close <= lower:
            return IndicatorSignal(
                self.key, self.label, 0.7, "Touching Lower Band",
                "Price is at or below the lower Bollinger Band — potentially "
                "oversold and stretched below its recent range.",
                values,
            )
        if close >= upper:
            return IndicatorSignal(
                self.key, self.label, -0.7, "Touching Upper Band",
                "Price is at or above the upper Bollinger Band — potentially "
                "overbought and stretched above its recent range.",
                values,
            )
        # Faint mean-reversion lean by position in the band; the strong
        # readings come from actual upper/lower band touches above.
        score = (0.5 - pct_b) * 0.2
        return IndicatorSignal(
            self.key, self.label, score, "Within Bands",
            f"Price is within its Bollinger Bands (%B = {pct_b:.2f}).",
            values,
        )

    def series(self, df: pd.DataFrame) -> dict:
        df = self.compute(df)
        f = lambda s: [None if pd.isna(v) else round(float(v), 4) for v in s]
        return {
            "bb_upper": f(df["bb_upper"]),
            "bb_mid": f(df["bb_mid"]),
            "bb_lower": f(df["bb_lower"]),
        }
