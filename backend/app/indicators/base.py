"""Indicator interface.

Adding a new indicator is intentionally cheap:
  1. Subclass `Indicator`.
  2. Implement `compute()` (adds columns to the DataFrame) and
     `evaluate()` (returns an `IndicatorSignal` for the latest bar).
  3. Register it in `registry.py`.

Nothing else in the app needs to change — the signal engine and the API
iterate over whatever is registered.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd


@dataclass
class IndicatorSignal:
    """Normalized output of a single indicator for the most recent bar.

    `score` is in [-1, 1]: negative = bearish, positive = bullish, 0 = neutral.
    The composite engine combines these; the UI shows `reason` verbatim.
    """

    key: str
    label: str
    score: float
    state: str          # short status, e.g. "Oversold", "Golden Cross"
    reason: str         # plain-English explanation
    values: dict = field(default_factory=dict)  # latest numeric values for display

    def __post_init__(self) -> None:
        # Keep scores well-behaved so weighting stays predictable.
        self.score = max(-1.0, min(1.0, float(self.score)))


class Indicator(ABC):
    #: Stable identifier used in API payloads and the registry.
    key: str = "base"
    #: Display name shown in the UI.
    label: str = "Base Indicator"
    #: Relative weight in the composite signal (see signals/composite.py).
    weight: float = 1.0

    @abstractmethod
    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return `df` with this indicator's columns added (does not mutate)."""
        raise NotImplementedError

    @abstractmethod
    def evaluate(self, df: pd.DataFrame) -> Optional[IndicatorSignal]:
        """Return a signal for the latest bar, or None if not enough data."""
        raise NotImplementedError

    def series(self, df: pd.DataFrame) -> dict:
        """Optional: named series for charting, e.g. {"sma50": [...]}.

        Returned lists are aligned to `df.index`; NaNs become None for JSON.
        Default: nothing to chart.
        """
        return {}
