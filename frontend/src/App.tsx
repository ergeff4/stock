import { useState } from "react";
import { analyzeTicker } from "./api";
import type { AnalysisResponse } from "./types";
import TickerInput from "./components/TickerInput";
import StockBrowser from "./components/StockBrowser";
import SignalCard from "./components/SignalCard";
import PriceChart from "./components/PriceChart";
import IndicatorBreakdown from "./components/IndicatorBreakdown";
import BacktestSummary from "./components/BacktestSummary";
import Disclaimer from "./components/Disclaimer";

export default function App() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeTicker(ticker);
      setData(result);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📈 Stock Signal Analyzer</h1>
        <p>
          Technical-analysis signals from moving averages, RSI, MACD, and
          Bollinger Bands — for education, not advice.
        </p>
      </header>

      <TickerInput onSubmit={handleAnalyze} loading={loading} />
      <StockBrowser onSelect={handleAnalyze} loading={loading} />

      {loading && <p className="loading">Fetching data and crunching indicators…</p>}
      {error && <p className="error">⚠ {error}</p>}

      {data && !loading && (
        <>
          <SignalCard data={data} />
          <PriceChart data={data.chart} />
          <IndicatorBreakdown indicators={data.indicators} />
          <BacktestSummary backtest={data.backtest} />
        </>
      )}

      <Disclaimer text={data?.disclaimer} />
    </div>
  );
}
