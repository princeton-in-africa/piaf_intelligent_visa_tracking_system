/* ============================================================================
   Charts
   ----------------------------------------------------------------------------
   Chart type follows the question, not the other way round:

     ranking a list of countries      -> horizontal bars (labels stay readable)
     one measure across few categories-> horizontal bars, not a pie
     composition of a whole           -> a single stacked bar, not a donut
     change over cohorts              -> an area line, but only with 2+ points

   There is no pie chart in this app. With 10+ visa types a pie is unreadable,
   and every comparison here is between magnitudes rather than parts of a whole.
   ========================================================================== */

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { CalendarClock } from 'lucide-react'
import { EmptyState } from './ui'
import './charts.css'

const AXIS_STYLE = {
  fontSize: 11,
  fill: '#78716C',
  fontFamily: 'var(--font-sans)',
}

const RISK_FILL = {
  high: 'var(--danger)',
  moderate: 'var(--warning)',
  low: 'var(--success)',
  unknown: 'var(--n-300)',
}

/* ── Tooltip ───────────────────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label, valueLabel = 'reports', extra }) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  const row = point.payload ?? {}

  return (
    <div className="chart-tip">
      <p className="chart-tip__label">{row.fullName ?? label}</p>
      <p className="chart-tip__value tnum">
        {point.value}
        {valueLabel ? ` ${valueLabel}` : ''}
      </p>
      {extra?.(row)}
    </div>
  )
}

/* ── Horizontal ranking bars ───────────────────────────────────────────── */

/**
 * Ranked categories as horizontal bars. Horizontal keeps long labels like
 * "Baylor International Pediatric AIDS Initiative" legible without rotation.
 */
export function RankedBarChart({ data, height = 280, valueLabel = 'reports', colorBy = 'level' }) {
  if (!data.length) {
    return <EmptyState compact title="Nothing to chart" description="No records match the current filters." />
  }

  const rows = data.map((item) => ({
    ...item,
    fullName: item.name,
    name: item.name.length > 26 ? `${item.name.slice(0, 24)}…` : item.name,
  }))

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--n-150)" />
          <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip
            cursor={{ fill: 'var(--n-100)' }}
            content={
              <ChartTooltip
                valueLabel={valueLabel}
                extra={(row) =>
                  row.rate !== null && row.rate !== undefined ? (
                    <p className="chart-tip__meta">{row.rate}% reported complications</p>
                  ) : null
                }
              />
            }
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((row, index) => (
              <Cell
                key={row.fullName}
                fill={
                  colorBy === 'level'
                    ? RISK_FILL[row.level] ?? 'var(--chart-1)'
                    : `var(--chart-${(index % 8) + 1})`
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Cohort trend ──────────────────────────────────────────────────────── */

/**
 * Complication rate across cohort years.
 *
 * A single cohort cannot show a trend. Rather than draw a one-point line that
 * implies a direction, this states plainly that there is no history yet and
 * explains what would make the chart meaningful.
 */
export function TrendChart({ data, height = 260 }) {
  const usable = data.filter((point) => point.rate !== null)

  if (usable.length < 2) {
    const only = usable[0]
    return (
      <EmptyState
        icon={CalendarClock}
        title="Not enough history for a trend yet"
        description={
          only
            ? `All ${only.total} reports are from the ${only.year} cohort, at a ${only.rate}% complication rate. Add a second cohort and this becomes a year-on-year trend.`
            : 'Load reports from more than one cohort year to see change over time.'
        }
      />
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-600)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--brand-600)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--n-150)" vertical={false} />
          <XAxis dataKey="year" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            width={44}
          />
          <Tooltip
            cursor={{ stroke: 'var(--n-300)', strokeWidth: 1 }}
            content={
              <ChartTooltip
                valueLabel="% complication rate"
                extra={(row) => <p className="chart-tip__meta">{row.total} reports in this cohort</p>}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--brand-600)"
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={{ r: 3.5, fill: 'var(--brand-600)', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 5.5, fill: 'var(--brand-600)', strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Composition bar ───────────────────────────────────────────────────── */

/**
 * One stacked bar showing how a whole divides up, used here instead of a pie
 * chart. Rendered in plain CSS so the segments stay crisp at any width.
 */
export function CompositionBar({ segments, total }) {
  if (!total) {
    return <EmptyState compact title="No data recorded" description="This field was not captured in any report." />
  }

  return (
    <div className="composition">
      <div className="composition__bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.count}`).join(', ')}>
        {segments.map((segment, index) => (
          <div
            key={segment.label}
            className="composition__segment"
            style={{
              width: `${(segment.count / total) * 100}%`,
              background: segment.color ?? `var(--chart-${(index % 8) + 1})`,
            }}
            title={`${segment.label}: ${segment.count} of ${total}`}
          />
        ))}
      </div>
      <ul className="composition__legend">
        {segments.map((segment, index) => (
          <li key={segment.label} className="composition__legend-item">
            <span
              className="composition__swatch"
              style={{ background: segment.color ?? `var(--chart-${(index % 8) + 1})` }}
              aria-hidden="true"
            />
            <span className="composition__legend-label">{segment.label}</span>
            <span className="composition__legend-value tnum">
              {segment.count}
              <span className="composition__legend-share">
                {Math.round((segment.count / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Paired comparison ─────────────────────────────────────────────────── */

/**
 * Two rates side by side, used for "before arrival vs after arrival".
 * A chart would be overkill for two numbers; the comparison itself is the point.
 */
export function ComparisonRows({ rows }) {
  const maxRate = Math.max(...rows.map((row) => row.rate ?? 0), 1)

  return (
    <div className="comparison">
      {rows.map((row) => (
        <div key={row.label} className="comparison__row">
          <div className="comparison__head">
            <span className="comparison__label">{row.label}</span>
            <span className="comparison__value tnum">
              {row.rate === null ? '—' : `${row.rate}%`}
              <span className="comparison__n">n={row.count}</span>
            </span>
          </div>
          <div className="comparison__track">
            <div
              className="comparison__fill"
              style={{
                width: `${row.rate === null ? 0 : Math.max((row.rate / maxRate) * 100, 2)}%`,
                background: row.color ?? 'var(--chart-2)',
              }}
            />
          </div>
          {row.note && <p className="comparison__note">{row.note}</p>}
        </div>
      ))}
    </div>
  )
}
