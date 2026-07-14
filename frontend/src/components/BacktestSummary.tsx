import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Backtest } from "../types";

function tickInterval(len: number): number {
  return Math.max(0, Math.floor(len / 12));
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
};

const axis = { stroke: "var(--axis)", tick: { fill: "var(--text-muted)" } };

function Stat({ label, value, sign }: { label: string; value: string; sign?: number }) {
  const cls = sign === undefined ? "" : sign >= 0 ? "pos" : "neg";
  return (
    <div className="stat">
      <p className="k">{label}</p>
      <p className={`v ${cls}`}>{value}</p>
    </div>
  );
}

export default function BacktestSummary({ backtest }: { backtest: Backtest }) {
  const b = backtest;
  const interval = tickInterval(b.equity_curve.length);
  const beat = b.strategy_return_pct - b.buy_hold_return_pct;

  return (
    <div className="card">
      <h2>Backtest — Following the Signals (past year)</h2>

      <div className="stat-row">
        <Stat
          label="Strategy return"
          value={`${b.strategy_return_pct >= 0 ? "+" : ""}${b.strategy_return_pct}%`}
          sign={b.strategy_return_pct}
        />
        <Stat
          label="Buy & hold return"
          value={`${b.buy_hold_return_pct >= 0 ? "+" : ""}${b.buy_hold_return_pct}%`}
          sign={b.buy_hold_return_pct}
        />
        <Stat
          label="Vs buy & hold"
          value={`${beat >= 0 ? "+" : ""}${beat.toFixed(2)} pts`}
          sign={beat}
        />
        <Stat label="Max drawdown" value={`${b.max_drawdown_pct}%`} sign={-1} />
        <Stat label="Trades" value={`${b.num_trades}`} />
        <Stat label="Win rate" value={`${b.win_rate_pct}%`} />
        <Stat label="Time in market" value={`${b.days_in_market_pct}%`} />
      </div>

      <p className="chart-title">Cumulative return: strategy vs buy &amp; hold</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={b.equity_curve}
          margin={{ top: 6, right: 12, left: 4, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" interval={interval} {...axis} minTickGap={20} />
          <YAxis
            width={54}
            {...axis}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => `${v}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Line
            type="monotone"
            dataKey="strategy"
            name="Strategy (signals)"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="buy_hold"
            name="Buy & hold"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <p
        style={{
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          marginTop: 12,
          lineHeight: 1.5,
        }}
      >
        Hypothetical results from applying the composite signal (long when Buy,
        cash when Sell, one-day execution lag). Excludes fees, taxes, and
        slippage. This is a sanity check on the strategy over past data — not a
        prediction, and not a promise of future returns.
      </p>
    </div>
  );
}
