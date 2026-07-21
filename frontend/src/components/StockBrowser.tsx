import { useState } from "react";

interface StockItem {
  ticker: string;
  name: string;
  tag: string;
}

interface StockGroup {
  label: string;
  items: StockItem[];
}

const POPULAR: StockGroup[] = [
  {
    label: "Tech",
    items: [
      { ticker: "AAPL",  name: "Apple",           tag: "Tech" },
      { ticker: "MSFT",  name: "Microsoft",        tag: "Tech" },
      { ticker: "NVDA",  name: "NVIDIA",           tag: "Tech" },
      { ticker: "GOOGL", name: "Alphabet",         tag: "Tech" },
      { ticker: "META",  name: "Meta Platforms",   tag: "Tech" },
      { ticker: "AMZN",  name: "Amazon",           tag: "Tech" },
      { ticker: "TSLA",  name: "Tesla",            tag: "EV" },
    ],
  },
  {
    label: "Finance",
    items: [
      { ticker: "JPM",   name: "JPMorgan Chase",   tag: "Bank" },
      { ticker: "BAC",   name: "Bank of America",  tag: "Bank" },
      { ticker: "V",     name: "Visa",             tag: "Payments" },
      { ticker: "MA",    name: "Mastercard",       tag: "Payments" },
      { ticker: "GS",    name: "Goldman Sachs",    tag: "Bank" },
    ],
  },
  {
    label: "Energy",
    items: [
      { ticker: "XOM",   name: "ExxonMobil",       tag: "Oil & Gas" },
      { ticker: "CVX",   name: "Chevron",          tag: "Oil & Gas" },
      { ticker: "ENPH",  name: "Enphase Energy",   tag: "Solar" },
      { ticker: "NEE",   name: "NextEra Energy",   tag: "Renewable" },
    ],
  },
  {
    label: "ETFs",
    items: [
      { ticker: "SPY",   name: "S&P 500 ETF",      tag: "Broad" },
      { ticker: "QQQ",   name: "Nasdaq-100 ETF",   tag: "Tech" },
      { ticker: "IWM",   name: "Russell 2000 ETF", tag: "Small-Cap" },
      { ticker: "VTI",   name: "Total Market ETF", tag: "Broad" },
    ],
  },
];

const UPCOMING: StockGroup[] = [
  {
    label: "Recent IPOs",
    items: [
      { ticker: "RDDT",  name: "Reddit",           tag: "IPO 2024" },
      { ticker: "ARM",   name: "Arm Holdings",     tag: "IPO 2023" },
      { ticker: "BIRK",  name: "Birkenstock",      tag: "IPO 2023" },
      { ticker: "KVYO",  name: "Klaviyo",          tag: "IPO 2023" },
      { ticker: "CART",  name: "Instacart",        tag: "IPO 2023" },
    ],
  },
  {
    label: "AI & Emerging Tech",
    items: [
      { ticker: "SOUN",  name: "SoundHound AI",    tag: "AI Voice" },
      { ticker: "BBAI",  name: "BigBear.ai",       tag: "AI Analytics" },
      { ticker: "IONQ",  name: "IonQ",             tag: "Quantum" },
      { ticker: "RGTI",  name: "Rigetti Computing",tag: "Quantum" },
      { ticker: "QBTS",  name: "D-Wave Quantum",   tag: "Quantum" },
      { ticker: "AIOT",  name: "Airgain",          tag: "IoT" },
    ],
  },
  {
    label: "Space & Defense",
    items: [
      { ticker: "ASTS",  name: "AST SpaceMobile",  tag: "Satellite" },
      { ticker: "RKLB",  name: "Rocket Lab",       tag: "Launch" },
      { ticker: "LUNR",  name: "Intuitive Machines",tag: "Lunar" },
      { ticker: "ACHR",  name: "Archer Aviation",  tag: "Air Taxi" },
      { ticker: "JOBY",  name: "Joby Aviation",    tag: "Air Taxi" },
    ],
  },
  {
    label: "Fintech",
    items: [
      { ticker: "NU",    name: "Nu Holdings",      tag: "Digital Bank" },
      { ticker: "SOFI",  name: "SoFi Technologies",tag: "Neobank" },
      { ticker: "HOOD",  name: "Robinhood",        tag: "Brokerage" },
      { ticker: "AFRM",  name: "Affirm",           tag: "BNPL" },
      { ticker: "UPST",  name: "Upstart",          tag: "AI Lending" },
    ],
  },
];

interface Props {
  onSelect: (ticker: string) => void;
  loading: boolean;
}

export default function StockBrowser({ onSelect, loading }: Props) {
  const [tab, setTab] = useState<"popular" | "upcoming">("popular");
  const groups = tab === "popular" ? POPULAR : UPCOMING;

  return (
    <div className="card stock-browser">
      <div className="browser-tabs">
        <button
          className={`browser-tab ${tab === "popular" ? "active" : ""}`}
          onClick={() => setTab("popular")}
        >
          Popular Stocks
        </button>
        <button
          className={`browser-tab ${tab === "upcoming" ? "active" : ""}`}
          onClick={() => setTab("upcoming")}
        >
          ✨ Rare &amp; Upcoming
        </button>
      </div>

      {tab === "upcoming" && (
        <p className="browser-note">
          Recent IPOs, quantum computing, space exploration, and next-gen fintech — lesser-known tickers with high growth potential.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.label} className="browser-group">
          <span className="browser-group-label">{group.label}</span>
          <div className="browser-chips">
            {group.items.map((s) => (
              <button
                key={s.ticker}
                className="stock-chip"
                disabled={loading}
                onClick={() => onSelect(s.ticker)}
                title={s.name}
              >
                <span className="chip-ticker">{s.ticker}</span>
                <span className="chip-name">{s.name}</span>
                <span className="chip-tag">{s.tag}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
