/* ============================================================================
   UI primitives
   ----------------------------------------------------------------------------
   Every visual pattern in the app is built from these, so spacing, radii,
   colour and interaction states stay identical across all three pages.
   Colours and sizes come from tokens, never hard-coded values.
   ========================================================================== */

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Inbox, Info } from 'lucide-react'
import './ui.css'

/* ── Card ──────────────────────────────────────────────────────────────── */

export function Card({ children, className = '', interactive = false, ...rest }) {
  return (
    <section
      className={`card ${interactive ? 'card--interactive' : ''} ${className}`}
      {...rest}
    >
      {children}
    </section>
  )
}

/**
 * Card header. The subtitle is where the card states the question it answers,
 * so a reader never has to infer what they are looking at.
 */
export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <header className="card__header">
      <div className="card__heading">
        <h3 className="card__title">
          {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
          {title}
        </h3>
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="card__action">{action}</div>}
    </header>
  )
}

export function CardBody({ children, className = '', flush = false }) {
  return <div className={`card__body ${flush ? 'card__body--flush' : ''} ${className}`}>{children}</div>
}

/* ── Page + section headings ───────────────────────────────────────────── */

export function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-header__title">{title}</h2>
        {description && <p className="section-header__description">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

/* ── Badges & pills ────────────────────────────────────────────────────── */

export function Badge({ children, tone = 'neutral', size = 'md', icon: Icon }) {
  return (
    <span className={`badge badge--${tone} badge--${size}`}>
      {Icon && <Icon size={12} strokeWidth={2.2} aria-hidden="true" />}
      {children}
    </span>
  )
}

const RISK_TONE = { high: 'danger', moderate: 'warning', low: 'success', unknown: 'neutral' }

/**
 * A complication rate rendered as a pill.
 * A rate with too small a sample is marked, so 100%-of-one never reads as fact.
 */
export function RiskBadge({ rate, level, confidence, showLabel = false }) {
  if (rate === null || rate === undefined) {
    return <Badge tone="neutral">No outcome data</Badge>
  }

  return (
    <span className="risk-badge">
      <Badge tone={RISK_TONE[level] ?? 'neutral'}>
        {rate}%{showLabel ? ` · ${level}` : ''}
      </Badge>
      {confidence === 'low' && (
        <span className="risk-badge__caveat" title="Fewer than 3 reports, so treat this as indicative">
          low n
        </span>
      )}
    </span>
  )
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className = '',
  ...rest
}) {
  return (
    <button type="button" className={`btn btn--${variant} btn--${size} ${className}`} {...rest}>
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  )
}

/* ── Form controls ─────────────────────────────────────────────────────── */

export function Select({ label, value, onChange, options, placeholder = 'All', id }) {
  // useId is the supported way to generate a stable id. Generating one with
  // Math.random during render is impure and can differ between renders.
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className="field__control">
        <select
          id={selectId}
          className="select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => {
            const optionValue = typeof option === 'string' ? option : option.value
            const optionLabel = typeof option === 'string' ? option : option.label
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search', label }) {
  return (
    <div className="field field--grow">
      {label && <label className="field__label sr-only" htmlFor="search-input">{label}</label>}
      <div className="search">
        <input
          id="search-input"
          type="search"
          className="search__input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  )
}

/** Segmented control, for switching a view rather than filtering. */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__item ${value === option.value ? 'is-active' : ''}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <option.icon size={13} strokeWidth={2} aria-hidden="true" />}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Toolbar({ children, className = '' }) {
  return <div className={`toolbar ${className}`}>{children}</div>
}

/* ── Numbers ───────────────────────────────────────────────────────────── */

/**
 * Counts up to its value on mount. Respects prefers-reduced-motion by
 * rendering the final value immediately.
 */
export function AnimatedNumber({ value, suffix = '', duration = 650 }) {
  // Read the motion preference once, in a lazy initialiser, so the reduced
  // case renders the final figure immediately and runs no effect at all.
  const [prefersReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  const [display, setDisplay] = useState(0)
  const frameRef = useRef()

  useEffect(() => {
    if (prefersReduced) return undefined
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined

    const start = performance.now()
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      // Ease-out cubic: fast first, settles gently on the final figure.
      const eased = 1 - (1 - progress) ** 3
      setDisplay(Math.round(value * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration, prefersReduced])

  if (typeof value !== 'number' || Number.isNaN(value)) return <>—</>

  return (
    <>
      {prefersReduced ? value : display}
      {suffix}
    </>
  )
}

/** A single headline figure with the evidence behind it. */
export function Stat({ label, value, suffix = '', context, tone = 'default', icon: Icon, animate = true }) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__label">
        {Icon && <Icon size={13} strokeWidth={2} aria-hidden="true" />}
        {label}
      </div>
      <div className="stat__value tnum">
        {animate && typeof value === 'number' ? (
          <AnimatedNumber value={value} suffix={suffix} />
        ) : (
          <>
            {value ?? '—'}
            {value !== null && value !== undefined ? suffix : ''}
          </>
        )}
      </div>
      {context && <div className="stat__context">{context}</div>}
    </div>
  )
}

/* ── Rate bar (used in every ranking list) ─────────────────────────────── */

const BAR_TONE = {
  high: 'var(--danger)',
  moderate: 'var(--warning)',
  low: 'var(--success)',
  unknown: 'var(--n-300)',
}

export function RateBar({ rate, level, max = 100 }) {
  // A true zero draws nothing. Giving 0% a minimum-width sliver would show a
  // coloured mark against a country that had no complications at all.
  const width =
    rate === null || rate === undefined || rate === 0 ? 0 : Math.max((rate / max) * 100, 2)
  return (
    <div className="rate-bar" aria-hidden="true">
      <div
        className="rate-bar__fill"
        style={{ width: `${width}%`, background: BAR_TONE[level] ?? 'var(--n-300)' }}
      />
    </div>
  )
}

/* ── States ────────────────────────────────────────────────────────────── */

export function EmptyState({ title, description, icon: Icon = Inbox, action, compact = false }) {
  return (
    <div className={`empty ${compact ? 'empty--compact' : ''}`}>
      <div className="empty__icon">
        <Icon size={compact ? 18 : 22} strokeWidth={1.6} aria-hidden="true" />
      </div>
      <p className="empty__title">{title}</p>
      {description && <p className="empty__description">{description}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 14, radius = 'var(--r-sm)', className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card skeleton-card">
      <Skeleton width="42%" height={12} />
      <Skeleton width="64%" height={10} />
      <div className="skeleton-card__lines">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} height={30} />
        ))}
      </div>
    </div>
  )
}

/* ── Notices ───────────────────────────────────────────────────────────── */

const NOTICE_ICON = { warning: AlertTriangle, danger: AlertTriangle, info: Info, success: Info }

export function Notice({ tone = 'info', title, children, action }) {
  const Icon = NOTICE_ICON[tone] ?? Info
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={15} strokeWidth={2} className="notice__icon" aria-hidden="true" />
      <div className="notice__content">
        {title && <p className="notice__title">{title}</p>}
        {children && <div className="notice__body">{children}</div>}
      </div>
      {action && <div className="notice__action">{action}</div>}
    </div>
  )
}

/* ── Scrollable list container ─────────────────────────────────────────── */

/**
 * Shows the first `previewCount` rows and reveals the rest inside a scroll
 * area, so a long ranking never truncates silently, and never pushes the
 * rest of the page off screen either.
 */
export function ExpandableList({
  items,
  previewCount = 5,
  renderItem,
  expandLabel = 'items',
  divider,
}) {
  const [expanded, setExpanded] = useState(false)
  const remaining = items.length - previewCount
  const visible = expanded ? items : items.slice(0, previewCount)

  return (
    <>
      <div className={`ranked-list ${expanded ? 'ranked-list--scroll' : ''}`}>
        {visible.map((item, index) => (
          <Fragment key={item.name ?? index}>
            {divider?.(item, index)}
            {renderItem(item, index)}
          </Fragment>
        ))}
      </div>
      {remaining > 0 && (
        <button type="button" className="list-toggle" onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Show fewer' : `Show all ${items.length} ${expandLabel}`}
        </button>
      )}
    </>
  )
}
