/* ============================================================================
   App root
   ----------------------------------------------------------------------------
   Owns three things and nothing else: which page is showing, the loaded data,
   and cross-page navigation (clicking a country on the Dashboard opens it in
   Lookup). All rendering lives in the page components.
   ========================================================================== */

import { useCallback, useEffect, useState } from 'react'
import './App.css'
import AppShell from './components/AppShell'
import { Notice, SkeletonCard } from './components/ui'
import Dashboard from './pages/Dashboard'
import Database from './pages/Database'
import Lookup from './pages/Lookup'
import { loadRecords } from './lib/data'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [records, setRecords] = useState([])
  const [source, setSource] = useState('live')
  const [sourceReason, setSourceReason] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // When a Dashboard row is clicked we hand the target to Lookup. A fresh
  // object is created each time, so Lookup can tell a repeat click apart from
  // a re-render and open the same entity again.
  const [focus, setFocus] = useState(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true)

    const result = await loadRecords()

    setRecords(result.records)
    setSource(result.source)
    setSourceReason(result.reason)
    setIsLoading(false)
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    // Fetching data on mount is exactly what an effect is for. Every setState
    // in `load` runs after `await loadRecords()` resolves, so nothing updates
    // state synchronously during this effect. The lint rule cannot see through
    // the async boundary to verify that.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const explore = useCallback((type, name) => {
    setFocus({ type, name })
    setPage('lookup')
  }, [])

  const renderPage = () => {
    if (isLoading) {
      return (
        <div className="grid grid--2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      )
    }

    if (page === 'lookup') {
      return <Lookup records={records} focus={focus} />
    }

    if (page === 'database') {
      return <Database records={records} />
    }

    return <Dashboard records={records} onExplore={explore} />
  }

  return (
    <AppShell
      activePage={page}
      onNavigate={setPage}
      source={source}
      sourceReason={sourceReason}
      onRefresh={() => load(true)}
      isRefreshing={isRefreshing}
      recordCount={records.length}
      wide={page === 'database'}
    >
      {!isLoading && source === 'snapshot' && (
        <div className="source-banner">
          <Notice tone="warning" title="Showing a bundled snapshot, not live data">
            <p>
              {sourceReason} Start the API with{' '}
              <code className="inline-code">uvicorn main:app --reload --port 8000</code> and press
              Refresh to load the current database. Everything below is real extracted data, but it
              will not reflect reports added since the snapshot was built.
            </p>
          </Notice>
        </div>
      )}
      {renderPage()}
    </AppShell>
  )
}
