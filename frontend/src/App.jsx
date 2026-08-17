
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
