const POINTS = Array.from({ length: 64 }, (_, i) => {
  const x = i / 63;
  const loss = 0.12 + 0.76 * Math.exp(-4.4 * x) + 0.035 * Math.sin(i * 1.9) * (1 - 0.6 * x);
  return `${i ? "L" : "M"}${(18 + x * 272).toFixed(1)} ${(118 - loss * 104).toFixed(1)}`;
}).join(" ");

export function LossCurve({ label }: { label: string }) {
  return <svg className="loss-curve" viewBox="0 0 300 136" role="img" aria-label={label}>
    <path className="loss-axis" d="M18 10V118H292" />
    <path className="loss-line" d={POINTS} />
    <text x="24" y="20">loss</text>
    <text x="250" y="132">étapes</text>
  </svg>;
}
