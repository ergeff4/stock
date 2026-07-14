export default function Disclaimer({ text }: { text?: string }) {
  return (
    <div className="disclaimer" role="note">
      <strong>⚠ Educational tool — not financial advice.</strong>{" "}
      {text ??
        "This app performs technical analysis for educational purposes only. " +
          "Signals are generated from historical price patterns and can be wrong. " +
          "Past performance does not predict future results. Do your own research " +
          "and consult a licensed financial professional before investing."}{" "}
      Nothing here is a recommendation to buy or sell any security.
    </div>
  );
}
