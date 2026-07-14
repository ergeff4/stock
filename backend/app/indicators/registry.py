"""Central registry of active indicators.

To add an indicator: import it and append an instance to `INDICATORS`.
The signal engine, backtest, and API all iterate this list, so no other
file needs to change.
"""
from __future__ import annotations

from typing import List

from .base import Indicator
from .bollinger import BollingerBands
from .macd import MACD
from .rsi import RSI
from .sma import MovingAverageCross

INDICATORS: List[Indicator] = [
    MovingAverageCross(short=50, long=200),
    RSI(period=14),
    MACD(fast=12, slow=26, signal=9),
    BollingerBands(period=20, num_std=2.0),
]


def all_series(df) -> dict:
    """Merge every indicator's chartable series into one dict."""
    out: dict = {}
    for ind in INDICATORS:
        out.update(ind.series(df))
    return out
