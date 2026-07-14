import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "../types";

interface Props {
  data: ChartPoint[];
}

// Show roughly monthly x-axis ticks regardless of series length.
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

export default function PriceChart({ data }: Props) {
  const interval = tickInterval(data.length);

  return (
    <div className="card">
      <h2>Price & Indicators</h2>

      {/* ── Panel 1: Price, moving averages, Bollinger bands ── */}
      <p className="chart-title">Price · SMA 50/200 · Bollinger Bands (20, 2σ)</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" interval={interval} {...axis} minTickGap={20} />
          <YAxis domain={["auto", "auto"]} width={54} {...axis} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="bb_upper"
            name="BB upper"
            stroke="var(--text-muted)"
            strokeDasharray="3 3"
            strokeWidth={1}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="bb_lower"
            name="BB lower"
            stroke="var(--text-muted)"
            strokeDasharray="3 3"
            strokeWidth={1}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="close"
            name="Close"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="sma50"
            name="SMA 50"
            stroke="var(--series-2)"
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="sma200"
            name="SMA 200"
            stroke="var(--series-3)"
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── Panel 2: RSI (own 0–100 axis) ── */}
      <p className="chart-title" style={{ marginTop: 18 }}>
        RSI (14) — overbought &gt; 70, oversold &lt; 30
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" interval={interval} {...axis} minTickGap={20} />
          <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} width={54} {...axis} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={70} stroke="var(--critical)" strokeDasharray="4 3" />
          <ReferenceLine y={30} stroke="var(--good)" strokeDasharray="4 3" />
          <Line
            type="monotone"
            dataKey="rsi"
            name="RSI"
            stroke="var(--series-1)"
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── Panel 3: MACD (own axis) ── */}
      <p className="chart-title" style={{ marginTop: 18 }}>
        MACD (12/26/9) — line vs signal, histogram
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="date" interval={interval} {...axis} minTickGap={20} />
          <YAxis width={54} {...axis} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Bar
            dataKey="macd_hist"
            name="Histogram"
            fill="var(--text-muted)"
            opacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="macd"
            name="MACD"
            stroke="var(--series-macd)"
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="macd_signal"
            name="Signal"
            stroke="var(--series-signal)"
            strokeWidth={1.75}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
