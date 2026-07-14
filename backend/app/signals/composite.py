"""Composite signal engine.

Combines the per-indicator scores (each in [-1, 1]) into a single
weighted-average score, then maps it to Buy / Hold / Sell. The point is
transparency, not a black box: every triggering indicator's reason is
returned so the UI can explain *why*.

This is an educational technical-analysis heuristic — not financial advice
and not a predictor of future results.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

import pandas as pd

from ..indicators.base import IndicatorSignal
from ..indicators.registry import INDICATORS

BUY_THRESHOLD = 0.25
SELL_THRESHOLD = -0.25


@dataclass
class CompositeSignal:
    action: str                 # "Buy" | "Hold" | "Sell"
    score: float                # weighted average in [-1, 1]
    confidence: float           # 0..1, magnitude of the score
    summary: str                # one-line plain-English summary
    reasons: List[str] = field(default_factory=list)
    indicators: List[IndicatorSignal] = field(default_factory=list)


def _action_for_score(score: float) -> str:
    if score >= BUY_THRESHOLD:
        return "Buy"
    if score <= SELL_THRESHOLD:
        return "Sell"
    return "Hold"


def evaluate(df: pd.DataFrame) -> CompositeSignal:
    """Run every registered indicator against `df` and combine the results."""
    signals: List[IndicatorSignal] = []
    weighted_sum = 0.0
    total_weight = 0.0

    for ind in INDICATORS:
        result = ind.evaluate(df)
        if result is None:
            continue
        signals.append(result)
        weighted_sum += result.score * ind.weight
        total_weight += ind.weight

    score = weighted_sum / total_weight if total_weight else 0.0
    action = _action_for_score(score)

    # Build the explanation from the indicators that lean the same way as
    # the overall call (or, for Hold, whichever are most active).
    if action == "Buy":
        drivers = [s for s in signals if s.score > 0.1]
    elif action == "Sell":
        drivers = [s for s in signals if s.score < -0.1]
    else:
        drivers = sorted(signals, key=lambda s: abs(s.score), reverse=True)[:2]

    reasons = [f"{s.label}: {s.reason}" for s in drivers] or [
        "No indicator produced a strong reading; the picture is mixed."
    ]

    summary = _summary(action, score, drivers)
    return CompositeSignal(
        action=action,
        score=round(score, 3),
        confidence=round(min(1.0, abs(score) / 0.6), 3),
        summary=summary,
        reasons=reasons,
        indicators=signals,
    )


def _summary(action: str, score: float, drivers: list) -> str:
    n = len(drivers)
    if action == "Buy":
        return (
            f"Composite score {score:+.2f} leans bullish; {n} indicator"
            f"{'s' if n != 1 else ''} support a Buy lean."
        )
    if action == "Sell":
        return (
            f"Composite score {score:+.2f} leans bearish; {n} indicator"
            f"{'s' if n != 1 else ''} support a Sell lean."
        )
    return (
        f"Composite score {score:+.2f} is near neutral; signals are mixed, "
        "suggesting Hold."
    )
