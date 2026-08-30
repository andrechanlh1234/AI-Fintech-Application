import type { selectNetWorthChart } from '../store/selectors';

/** Compact, non-interactive preview of the Net Worth trend -- same
 * chart.pts/linePoints/areaPoints as the full scrubbable chart on the Net
 * Worth page (selectNetWorthChart), just rendered smaller and without the
 * scrub/selection interactions. Never a separate/hardcoded dataset. */
export function NetWorthSparkline({ chart, height = 56 }: { chart: ReturnType<typeof selectNetWorthChart>; height?: number }) {
  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={height} viewBox="0 0 300 140" preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="nwSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={chart.areaPoints} fill="url(#nwSparkFill)" />
        <polyline points={chart.linePoints} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* HTML, not SVG: preserveAspectRatio="none" stretches x/y unevenly to
          fill the card width, which would turn an SVG <circle> into an
          ellipse -- see NetWorthSection.tsx for the same fix. */}
      {chart.pts.length > 0 && (
        <div style={{
          position: 'absolute', left: `${(chart.pts[chart.pts.length - 1][0] / 300) * 100}%`, top: `${(chart.pts[chart.pts.length - 1][1] / 140) * 100}%`,
          width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', border: '2px solid var(--color-surface)', boxSizing: 'border-box',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}
