// Shape of the /api/analyze/{ticker} response (mirrors backend/app/main.py).

export interface IndicatorSignal {
  key: string;
  label: string;
  score: number;
  state: string;
  reason: string;
  values: Record<string, number>;
}

export interface ChartPoint {
  date: string;
  close: number;
  sma50: number | null;
  sma200: number | null;
  bb_upper: number | null;
  bb_mid: number | null;
  bb_lower: number | null;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_hist: number | null;
}

export interface Trade {
  date: string;
  action: string;
  price: number;
}

export interface Backtest {
  equity_curve: { date: string; strategy: number; buy_hold: number }[];
  trades: Trade[];
  strategy_return_pct: number;
  buy_hold_return_pct: number;
  max_drawdown_pct: number;
  num_trades: number;
  win_rate_pct: number;
  days_in_market_pct: number;
}

export interface AnalysisResponse {
  ticker: string;
  data_source: string;
  as_of: string;
  last_close: number;
  signal: {
    action: "Buy" | "Hold" | "Sell";
    score: number;
    confidence: number;
    summary: string;
    reasons: string[];
  };
  indicators: IndicatorSignal[];
  chart: ChartPoint[];
  backtest: Backtest;
  disclaimer: string;
}
