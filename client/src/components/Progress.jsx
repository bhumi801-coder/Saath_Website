export default function Progress({ joined, target, label }) {
  const pct = Math.min(100, Math.round((joined / target) * 100));
  return (
    <div
      className={`progress${joined >= target ? ' done' : ''}`}
      role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(joined, target)}
      aria-label={label || `${joined} of ${target} flats joined`}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
