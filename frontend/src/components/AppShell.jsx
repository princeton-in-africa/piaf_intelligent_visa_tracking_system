/* ============================================================================
   Application shell: sidebar, top bar and mobile navigation
   ----------------------------------------------------------------------------
   Owns navigation and the data-source indicator. No page content lives here.
   ========================================================================== */

import { useEffect, useState } from 'react'
import {
  Database, LayoutDashboard, Menu, RefreshCw, Search, X, Wifi, WifiOff,
} from 'lucide-react'
import Logo from './Logo'
import './AppShell.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'What is happening' },
  { id: 'lookup', label: 'Lookup', icon: Search, description: 'Explore a country or organisation' },
  { id: 'database', label: 'Database', icon: Database, description: 'Every extracted report' },
]

function SourcePill({ source, reason }) {
  const isLive = source === 'live'
  const Icon = isLive ? Wifi : WifiOff

  return (
    <span
      className={`source-pill source-pill--${isLive ? 'live' : 'snapshot'}`}
      title={
        isLive
          ? 'Connected to the local FastAPI backend'
          : `${reason ?? 'Backend unavailable.'} Showing the snapshot bundled with the app.`
      }
    >
      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      {isLive ? 'Live data' : 'Offline snapshot'}
    </span>
  )
}

export default function AppShell({
  activePage,
  onNavigate,
  source,
  sourceReason,
  onRefresh,
  isRefreshing,
  recordCount,
  wide = false,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the drawer on Escape, as expected of any overlay.
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  const activeItem = NAV_ITEMS.find((item) => item.id === activePage)

  const navigate = (id) => {
    onNavigate(id)
    setMobileOpen(false)
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar__brand">
          <Logo />
          <span className="sidebar__brand-text">
            <span className="sidebar__product">Visa Intelligence</span>
            <span className="sidebar__org">Princeton in Africa</span>
          </span>
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activePage === item.id ? 'is-active' : ''}`}
              onClick={() => navigate(item.id)}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <item.icon size={16} strokeWidth={2} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <SourcePill source={source} reason={sourceReason} />
          <p className="sidebar__footer-note">
            {recordCount} fellowship {recordCount === 1 ? 'report' : 'reports'} analysed
          </p>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar__scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="shell__main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu size={18} strokeWidth={2} />
          </button>

          <div className="topbar__context">
            <span className="topbar__crumb">Visa Intelligence</span>
            <span className="topbar__divider" aria-hidden="true">
              /
            </span>
            <span className="topbar__current">{activeItem?.label ?? 'Dashboard'}</span>
          </div>

          <div className="topbar__actions">
            <span className="topbar__source">
              <SourcePill source={source} reason={sourceReason} />
            </span>
            <button
              type="button"
              className="topbar__refresh"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Reload data"
            >
              <RefreshCw
                size={15}
                strokeWidth={2}
                className={isRefreshing ? 'is-spinning' : ''}
                aria-hidden="true"
              />
              <span className="topbar__refresh-label">Refresh</span>
            </button>
          </div>
        </header>

        <main
          className={`content ${wide ? 'content--wide' : ''}`}
          id="main-content"
          tabIndex={-1}
        >
          <div className="content__inner">{children}</div>
        </main>
      </div>
    </div>
  )
}
