// TypeScript port of the Python backend, for running on Cloudflare Pages
// Functions (Workers runtime). It fetches Yahoo Finance's public JSON chart
// endpoint and reproduces the same indicators, composite signal, and backtest
// as backend/app. The Python version remains the tested local reference; this
// is the deployed implementation. Kept dependency-free (only `fetch`).
//
// NOT financial advice. Educational technical analysis only.

type Num = number | null;

// ── numeric helpers ─────────────────────────────────────────────────────────
function roundTo(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}
function clamp(v: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}
function mapRound(arr: Num[], d: number): Num[] {
  return arr.map((v) => (v === null ? null : roundTo(v, d)));
}

// ── indicator primitives ────────────────────────────────────────────────────
function sma(values: number[], period: number): Num[] {
  const out: Num[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// Sample standard deviation (ddof=1) over a rolling window — matches pandas .std().
function rollingStd(values: number[], period: number): Num[] {
  const out: Num[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let mean = 0;
    for (let k = i - period + 1; k <= i; k++) mean += values[k];
    mean /= period;
    let variance = 0;
    for (let k = i - period + 1; k <= i; k++) variance += (values[k] - mean) ** 2;
    out[i] = Math.sqrt(variance / (period - 1));
  }
  return out;
}

// EMA with adjust=false (recursive) — matches pandas ewm(span, adjust=False).
function ema(values: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const out: number[] = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

// Classic Wilder RSI (SMA-seeded recursive smoothing).
function rsi(values: number[], period = 14): Num[] {
  const n = values.length;
  const out: Num[] = new Array(n).fill(null);
  if (n <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    avgGain += Math.max(d, 0);
    avgLoss += Math.max(-d, 0);
  }
  avgGain /= period;
  avgLoss /= period;
  const rsiAt = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[period] = rsiAt(avgGain, avgLoss);
  for (let i = period + 1; i < n; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = rsiAt(avgGain, avgLoss);
  }
  return out;
}

// ── indicator set (mirrors backend/app/indicators + registry weights) ────────
export interface IndicatorSignal {
  key: string;
  label: string;
  score: number;
  state: string;
  reason: string;
  values: Record<string, number>;
}

interface Series {
  sma50: Num[];
  sma200: Num[];
  rsi: Num[];
  macd: number[];
  macdSignal: number[];
  macdHist: number[];
  bbUpper: Num[];
  bbMid: Num[];
  bbLower: Num[];
}

function computeSeries(close: number[]): Series {
  const sma50 = sma(close, 50);
  const sma200 = sma(close, 200);
  const macdLine = ema(close, 12).map((v, i) => v - ema(close, 26)[i]);
  const macdSignal = ema(macdLine, 9);
  const macdHist = macdLine.map((v, i) => v - macdSignal[i]);
  const bbMidArr = sma(close, 20);
  const std = rollingStd(close, 20);
  const bbUpper = bbMidArr.map((m, i) =>
    m === null || std[i] === null ? null : m + 2 * (std[i] as number)
  );
  const bbLower = bbMidArr.map((m, i) =>
    m === null || std[i] === null ? null : m - 2 * (std[i] as number)
  );
  return {
    sma50,
    sma200,
    rsi: rsi(close, 14),
    macd: macdLine,
    macdSignal,
    macdHist,
    bbUpper,
    bbMid: bbMidArr,
    bbLower,
  };
}

// Each scorer returns a signal for bar `i`, or null if not enough data.
// Weights match backend/app/indicators/registry.py.
const WEIGHTS = { sma_cross: 1.5, rsi: 1.0, macd: 1.0, bollinger: 1.0 };

function smaScore(s: Series, i: number): IndicatorSignal | null {
  if (i < 1) return null;
  const s0 = s.sma50[i];
  const l0 = s.sma200[i];
  const sp = s.sma50[i - 1];
  const lp = s.sma200[i - 1];
  if (s0 === null || l0 === null || sp === null || lp === null) return null;
  const values = { sma50: roundTo(s0, 2), sma200: roundTo(l0, 2) };
  const crossedUp = sp <= lp && s0 > l0;
  const crossedDown = sp >= lp && s0 < l0;
  const label = "Moving Averages (50/200)";
  if (crossedUp)
    return {
      key: "sma_cross", label, score: 1.0, state: "Golden Cross",
      reason:
        "The 50-day average just crossed above the 200-day average (golden cross), a classic bullish trend signal.",
      values,
    };
  if (crossedDown)
    return {
      key: "sma_cross", label, score: -1.0, state: "Death Cross",
      reason:
        "The 50-day average just crossed below the 200-day average (death cross), a classic bearish trend signal.",
      values,
    };
  if (s0 > l0)
    return {
      key: "sma_cross", label, score: 0.4, state: "Uptrend",
      reason:
        "The 50-day average is above the 200-day average, indicating a longer-term uptrend.",
      values,
    };
  return {
    key: "sma_cross", label, score: -0.4, state: "Downtrend",
    reason:
      "The 50-day average is below the 200-day average, indicating a longer-term downtrend.",
    values,
  };
}

function rsiScore(s: Series, i: number): IndicatorSignal | null {
  const r = s.rsi[i];
  if (r === null) return null;
  const label = "RSI (14)";
  const values = { rsi: roundTo(r, 2) };
  if (r <= 30) {
    const score = clamp(Math.min(1.0, (30 - r) / 30 + 0.5));
    return {
      key: "rsi", label, score, state: "Oversold",
      reason: `RSI is ${r.toFixed(1)}, below 30 (oversold) — the stock may be due for a bounce.`,
      values,
    };
  }
  if (r >= 70) {
    const score = clamp(-Math.min(1.0, (r - 70) / 30 + 0.5));
    return {
      key: "rsi", label, score, state: "Overbought",
      reason: `RSI is ${r.toFixed(1)}, above 70 (overbought) — momentum may be overextended.`,
      values,
    };
  }
  return {
    key: "rsi", label, score: clamp(((50 - r) / 50) * 0.15), state: "Neutral",
    reason: `RSI is ${r.toFixed(1)}, in the neutral 30–70 range.`,
    values,
  };
}

function macdScore(s: Series, i: number): IndicatorSignal | null {
  if (i < 34) return null; // slow(26) + signal(9) - 1
  const m0 = s.macd[i];
  const g0 = s.macdSignal[i];
  const mp = s.macd[i - 1];
  const gp = s.macdSignal[i - 1];
  const label = "MACD (12/26/9)";
  const values = {
    macd: roundTo(m0, 4),
    signal: roundTo(g0, 4),
    hist: roundTo(s.macdHist[i], 4),
  };
  const crossedUp = mp <= gp && m0 > g0;
  const crossedDown = mp >= gp && m0 < g0;
  if (crossedUp)
    return {
      key: "macd", label, score: 0.9, state: "Bullish Crossover",
      reason: "MACD just crossed above its signal line — bullish momentum shift.",
      values,
    };
  if (crossedDown)
    return {
      key: "macd", label, score: -0.9, state: "Bearish Crossover",
      reason: "MACD just crossed below its signal line — bearish momentum shift.",
      values,
    };
  if (m0 > g0)
    return {
      key: "macd", label, score: 0.35, state: "Bullish",
      reason: "MACD is above its signal line, supporting upward momentum.",
      values,
    };
  return {
    key: "macd", label, score: -0.35, state: "Bearish",
    reason: "MACD is below its signal line, supporting downward momentum.",
    values,
  };
}

function bollingerScore(close: number[], s: Series, i: number): IndicatorSignal | null {
  const u = s.bbUpper[i];
  const l = s.bbLower[i];
  const m = s.bbMid[i];
  if (u === null || l === null || m === null) return null;
  const c = close[i];
  const width = u - l;
  const pctB = width ? (c - l) / width : 0.5;
  const label = "Bollinger Bands (20, 2σ)";
  const values = {
    upper: roundTo(u, 2), lower: roundTo(l, 2), mid: roundTo(m, 2),
    percent_b: roundTo(pctB, 3),
  };
  if (c <= l)
    return {
      key: "bollinger", label, score: 0.7, state: "Touching Lower Band",
      reason:
        "Price is at or below the lower Bollinger Band — potentially oversold and stretched below its recent range.",
      values,
    };
  if (c >= u)
    return {
      key: "bollinger", label, score: -0.7, state: "Touching Upper Band",
      reason:
        "Price is at or above the upper Bollinger Band — potentially overbought and stretched above its recent range.",
      values,
    };
  return {
    key: "bollinger", label, score: clamp((0.5 - pctB) * 0.2), state: "Within Bands",
    reason: `Price is within its Bollinger Bands (%B = ${pctB.toFixed(2)}).`,
    values,
  };
}

// ── composite signal (mirrors signals/composite.py) ──────────────────────────
export interface CompositeSignal {
  action: "Buy" | "Hold" | "Sell";
  score: number;
  confidence: number;
  summary: string;
  reasons: string[];
  indicators: IndicatorSignal[];
}

function evaluateAt(close: number[], s: Series, i: number): CompositeSignal {
  const scorers: [IndicatorSignal | null, number][] = [
    [smaScore(s, i), WEIGHTS.sma_cross],
    [rsiScore(s, i), WEIGHTS.rsi],
    [macdScore(s, i), WEIGHTS.macd],
    [bollingerScore(close, s, i), WEIGHTS.bollinger],
  ];
  const signals: IndicatorSignal[] = [];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [sig, w] of scorers) {
    if (!sig) continue;
    signals.push(sig);
    weightedSum += sig.score * w;
    totalWeight += w;
  }
  const score = totalWeight ? weightedSum / totalWeight : 0;
  const action = score >= 0.25 ? "Buy" : score <= -0.25 ? "Sell" : "Hold";

  let drivers: IndicatorSignal[];
  if (action === "Buy") drivers = signals.filter((x) => x.score > 0.1);
  else if (action === "Sell") drivers = signals.filter((x) => x.score < -0.1);
  else drivers = [...signals].sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 2);

  const reasons =
    drivers.length > 0
      ? drivers.map((d) => `${d.label}: ${d.reason}`)
      : ["No indicator produced a strong reading; the picture is mixed."];

  const n = drivers.length;
  const plural = n !== 1 ? "s" : "";
  const sscore = (score >= 0 ? "+" : "") + score.toFixed(2);
  let summary: string;
  if (action === "Buy")
    summary = `Composite score ${sscore} leans bullish; ${n} indicator${plural} support a Buy lean.`;
  else if (action === "Sell")
    summary = `Composite score ${sscore} leans bearish; ${n} indicator${plural} support a Sell lean.`;
  else
    summary = `Composite score ${sscore} is near neutral; signals are mixed, suggesting Hold.`;

  return {
    action,
    score: roundTo(score, 3),
    confidence: roundTo(Math.min(1.0, Math.abs(score) / 0.6), 3),
    summary,
    reasons,
    indicators: signals,
  };
}

// ── backtest (mirrors backtest/engine.py) ────────────────────────────────────
export interface Backtest {
  equity_curve: { date: string; strategy: number; buy_hold: number }[];
  trades: { date: string; action: string; price: number }[];
  strategy_return_pct: number;
  buy_hold_return_pct: number;
  max_drawdown_pct: number;
  num_trades: number;
  win_rate_pct: number;
  days_in_market_pct: number;
}

function maxDrawdown(pctCurve: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const pct of pctCurve) {
    const equity = 1 + pct / 100;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDd = Math.min(maxDd, ((equity - peak) / peak) * 100);
  }
  return maxDd;
}

function runBacktest(
  dates: string[],
  close: number[],
  s: Series,
  lookback = 252
): Backtest {
  const n = close.length;
  const empty: Backtest = {
    equity_curve: [], trades: [], strategy_return_pct: 0, buy_hold_return_pct: 0,
    max_drawdown_pct: 0, num_trades: 0, win_rate_pct: 0, days_in_market_pct: 0,
  };
  if (n < 30) return empty;

  const start = Math.max(1, n - lookback);
  let strat = 1.0;
  let hold = 1.0;
  let position = 0;
  let prevClose = close[start];
  const baseClose = close[start];

  const curve: Backtest["equity_curve"] = [];
  const trades: Backtest["trades"] = [];
  let daysLong = 0;
  let entryPrice: number | null = null;
  let wins = 0;
  let closedTrades = 0;

  for (let j = start; j < n; j++) {
    const c = close[j];
    const dailyRet = c / prevClose - 1;
    if (position === 1) {
      strat *= 1 + dailyRet;
      daysLong++;
    }
    hold = c / baseClose;

    const action = evaluateAt(close, s, j).action;
    let newPos = position;
    if (action === "Buy") newPos = 1;
    else if (action === "Sell") newPos = 0;

    if (newPos !== position) {
      trades.push({ date: dates[j], action, price: roundTo(c, 2) });
      if (newPos === 1) entryPrice = c;
      else if (position === 1 && entryPrice !== null) {
        closedTrades++;
        if (c > entryPrice) wins++;
        entryPrice = null;
      }
      position = newPos;
    }

    curve.push({
      date: dates[j],
      strategy: roundTo((strat - 1) * 100, 2),
      buy_hold: roundTo((hold - 1) * 100, 2),
    });
    prevClose = c;
  }

  if (position === 1 && entryPrice !== null) {
    closedTrades++;
    if (prevClose > entryPrice) wins++;
  }

  const windowLen = n - start;
  return {
    equity_curve: curve,
    trades,
    strategy_return_pct: roundTo((strat - 1) * 100, 2),
    buy_hold_return_pct: roundTo((hold - 1) * 100, 2),
    max_drawdown_pct: roundTo(maxDrawdown(curve.map((p) => p.strategy)), 2),
    num_trades: trades.length,
    win_rate_pct: closedTrades ? roundTo((wins / closedTrades) * 100, 1) : 0,
    days_in_market_pct: windowLen ? roundTo((daysLong / windowLen) * 100, 1) : 0,
  };
}

export const DISCLAIMER =
  "This tool provides educational technical analysis only. It is not financial " +
  "advice, and past performance does not predict future results. Do your own " +
  "research and consult a licensed professional before investing.";

// ── assembly ─────────────────────────────────────────────────────────────────
export interface AnalysisPayload {
  ticker: string;
  data_source: string;
  as_of: string;
  last_close: number;
  signal: Omit<CompositeSignal, "indicators">;
  indicators: IndicatorSignal[];
  chart: Record<string, Num | string>[];
  backtest: Backtest;
  disclaimer: string;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function buildAnalysisFromSeries(
  ticker: string,
  dates: string[],
  close: number[]
): AnalysisPayload {
  if (close.length < 60) {
    throw new HttpError(
      422,
      `Not enough price history for '${ticker.toUpperCase()}' to analyze.`
    );
  }
  const s = computeSeries(close);
  const n = close.length;
  const sig = evaluateAt(close, s, n - 1);
  const backtest = runBacktest(dates, close, s, 252);

  const tail = 252;
  const startIdx = Math.max(0, n - tail);
  const sma50R = mapRound(s.sma50, 4);
  const sma200R = mapRound(s.sma200, 4);
  const rsiR = mapRound(s.rsi, 2);
  const macdR = mapRound(s.macd, 4);
  const macdSigR = mapRound(s.macdSignal, 4);
  const macdHistR = mapRound(s.macdHist, 4);
  const bbUpR = mapRound(s.bbUpper, 4);
  const bbMidR = mapRound(s.bbMid, 4);
  const bbLoR = mapRound(s.bbLower, 4);

  const chart: AnalysisPayload["chart"] = [];
  for (let i = startIdx; i < n; i++) {
    chart.push({
      date: dates[i],
      close: roundTo(close[i], 2),
      sma50: sma50R[i],
      sma200: sma200R[i],
      bb_upper: bbUpR[i],
      bb_mid: bbMidR[i],
      bb_lower: bbLoR[i],
      rsi: rsiR[i],
      macd: macdR[i],
      macd_signal: macdSigR[i],
      macd_hist: macdHistR[i],
    });
  }

  return {
    ticker: ticker.toUpperCase(),
    data_source: "yahoo-finance",
    as_of: dates[n - 1],
    last_close: roundTo(close[n - 1], 2),
    signal: {
      action: sig.action,
      score: sig.score,
      confidence: sig.confidence,
      summary: sig.summary,
      reasons: sig.reasons,
    },
    indicators: sig.indicators,
    chart,
    backtest,
    disclaimer: DISCLAIMER,
  };
}

// ── Yahoo Finance fetch (public v8 chart JSON) ───────────────────────────────
export async function fetchYahoo(
  ticker: string
): Promise<{ dates: string[]; close: number[] }> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) throw new HttpError(400, "Ticker must not be empty.");
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=2y&interval=1d`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
    });
  } catch (e) {
    throw new HttpError(502, `Failed to reach Yahoo Finance: ${(e as Error).message}`);
  }
  if (res.status === 404)
    throw new HttpError(404, `No data found for '${symbol}'. Is the symbol correct?`);
  if (!res.ok)
    throw new HttpError(502, `Yahoo Finance returned HTTP ${res.status} for '${symbol}'.`);

  const json: any = await res.json();
  if (json?.chart?.error)
    throw new HttpError(404, `No data found for '${symbol}'. Is the symbol correct?`);
  const result = json?.chart?.result?.[0];
  const timestamps: number[] | undefined = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  const adj: (number | null)[] | undefined = result?.indicators?.adjclose?.[0]?.adjclose;
  const closeRaw: (number | null)[] | undefined = adj ?? quote?.close;
  if (!timestamps || !closeRaw)
    throw new HttpError(404, `No price data returned for '${symbol}'.`);

  const dates: string[] = [];
  const close: number[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closeRaw[i];
    if (c === null || c === undefined || Number.isNaN(c)) continue;
    dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
    close.push(c);
  }
  return { dates, close };
}

export async function buildAnalysis(ticker: string): Promise<AnalysisPayload> {
  const { dates, close } = await fetchYahoo(ticker);
  return buildAnalysisFromSeries(ticker, dates, close);
}
