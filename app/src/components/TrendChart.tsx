import { useState } from 'react'

export type Point = { date: string; value: number; label: string } // label = date shown in tooltip

// One-series line chart: 2px line in the lift colour, 8px markers with a surface ring,
// recessive grid, last point labelled, tap/hover for any point's value.
type Props = { points: Point[]; unit: string; caption?: string; tone?: 'lift' | 'neutral' }

export default function TrendChart({ points, unit, caption = 'Top set per session', tone = 'lift' }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const W = 320, H = 150, L = 34, R = 12, T = 18, B = 22

  const vals = points.map((p) => p.value)
  const [lo, hi] = niceRange(Math.min(...vals), Math.max(...vals))
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1))
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B)
  const ticks = [lo, (lo + hi) / 2, hi]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points.length - 1
  const shown = active ?? last
  const fmt = (v: number) => String(Math.round(v * 10) / 10)

  function nearest(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i })
    setActive(best)
  }

  return (
    <figure className={`trend ${tone}`}>
      <figcaption className="cap">
        {caption}, {unit}. <span className="trend-read">{points[shown].label}: <b>{fmt(points[shown].value)} {unit}</b></span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${caption}, ${points.length} points, latest ${fmt(points[last].value)} ${unit}`}
        onPointerMove={nearest} onPointerDown={nearest} onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
          </g>
        ))}
        <text x={x(0)} y={H - 4} className="axis" textAnchor={points.length === 1 ? 'middle' : 'start'}>{points[0].label}</text>
        {last > 0 && <text x={x(last)} y={H - 4} className="axis" textAnchor="end">{points[last].label}</text>}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={T} y2={H - B} className="crosshair" />}
        <path d={path} className="line" />
        {points.map((p, i) => (
          <circle key={p.date + i} cx={x(i)} cy={y(p.value)} r={i === shown ? 5.5 : 4} className={i === shown ? 'dot on' : 'dot'} />
        ))}
      </svg>
    </figure>
  )
}

// Round the axis to tidy steps, with headroom so a flat series still shows
function niceRange(min: number, max: number): [number, number] {
  if (min === max) { min -= 5; max += 5 }
  const span = max - min
  const step = [1, 2, 2.5, 5, 10, 20, 25, 50].find((s) => span / s <= 4) ?? 100
  return [Math.max(0, Math.floor(min / step) * step), Math.ceil(max / step) * step]
}
