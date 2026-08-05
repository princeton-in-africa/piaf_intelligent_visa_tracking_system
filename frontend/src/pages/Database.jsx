/* ============================================================================
   Database: every extracted record
   ----------------------------------------------------------------------------
   The audit surface: where someone checks what the extractor actually pulled
   out of a PDF. Priorities are density, sorting, search and export.

   Column widths are fixed minimums so Country, Organisation and Visa Type can
   never be truncated to the point of ambiguity, and the challenge narrative is
   hidden behind a per-row toggle so one long answer can't blow up every row.
   ========================================================================== */

import { Fragment, useMemo, useState } from 'react'
import {
  ChevronDown, ChevronsUpDown, ChevronUp, Download,
  FileWarning, Search as SearchIcon, X,
} from 'lucide-react'
import {
  Badge, Button, Card, EmptyState, PageHeader,
  SearchInput, Select, Toolbar,
} from '../components/ui'
import { distinct } from '../lib/analytics'
import './pages.css'

const PAGE_SIZE = 25

// Minimum widths, tuned so the full grid fits a 1440px window without
// horizontal scrolling while still guaranteeing that Country, Organisation and
// Visa type are never squeezed to the point of ambiguity. Narrower windows
// scroll horizontally, which is the correct behaviour for a data grid.
const COLUMNS = [
  { key: 'country', label: 'Country', width: 132, sortable: true },
  { key: 'organization', label: 'Organisation', width: 192, sortable: true },
  { key: 'visaType', label: 'Visa type', width: 142, sortable: true },
  { key: 'year', label: 'Cohort', width: 68, sortable: true, align: 'center' },
  { key: 'timing', label: 'Obtained', width: 96, sortable: true },
  { key: 'whoPaid', label: 'Paid by', width: 90, sortable: true },
  { key: 'hadChallenges', label: 'Outcome', width: 112, sortable: true },
  // Expand control lives in its own narrow column so it can never push the
  // outcome badge onto a second line and double the height of every row.
  { key: '_expand', label: '', width: 40, sortable: false, align: 'center' },
]

const CSV_COLUMNS = [
  ['file', 'Source file'],
  ['country', 'Country'],
  ['organization', 'Organisation'],
  ['year', 'Cohort'],
  ['reportType', 'Report type'],
  ['visaType', 'Visa type'],
  ['visaTypeRaw', 'Visa type (as written)'],
  ['timing', 'Obtained'],
  ['whoPaid', 'Paid by'],
  ['hadChallenges', 'Had complications'],
  ['challengeDetails', 'Complication details'],
  ['advice', 'Advice for future Fellows'],
  ['isSuspectedDuplicate', 'Suspected duplicate'],
]

/** RFC-4180 escaping: quote everything, double any embedded quotes. */
function toCsvCell(value) {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

function downloadCsv(records) {
  const header = CSV_COLUMNS.map(([, label]) => toCsvCell(label)).join(',')
  const rows = records.map((record) =>
    CSV_COLUMNS.map(([key]) => toCsvCell(record[key])).join(','),
  )
  // Leading BOM (\uFEFF) keeps Excel from mangling accented place names such
  // as "Séjour". Written as an escape rather than a literal, invisible character.
  const csv = `\uFEFF${[header, ...rows].join('\r\n')}`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `piaf-visa-records-${stamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function OutcomeCell({ record }) {
  const tone =
    record.hadChallenges === 'Yes' ? 'danger' : record.hadChallenges === 'No' ? 'success' : 'neutral'

  return (
    <Badge tone={tone} size="sm">
      {record.hadChallenges === 'Yes'
        ? 'Complication'
        : record.hadChallenges === 'No'
          ? 'Clean'
          : 'Unknown'}
    </Badge>
  )
}

export default function Database({ records }) {
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [visaFilter, setVisaFilter] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [sort, setSort] = useState({ key: 'country', direction: 'asc' })
  const [expanded, setExpanded] = useState({})
  const [page, setPage] = useState(0)

  const countries = useMemo(() => distinct(records, 'country'), [records])
  const organizations = useMemo(() => distinct(records, 'organization'), [records])
  const visaTypes = useMemo(() => distinct(records, 'visaType'), [records])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return records.filter((record) => {
      if (countryFilter && record.country !== countryFilter) return false
      if (orgFilter && record.organization !== orgFilter) return false
      if (visaFilter && record.visaType !== visaFilter) return false
      if (outcomeFilter && record.hadChallenges !== outcomeFilter) return false
      if (!needle) return true

      // Search covers the narrative fields too, because that is where the useful
      // detail lives, and staff search for things like "police clearance".
      return [
        record.country, record.organization, record.visaType, record.visaTypeRaw,
        record.challengeDetails, record.advice, record.file, record.obtainedWhere,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [records, query, countryFilter, orgFilter, visaFilter, outcomeFilter])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => {
      const left = a[sort.key]
      const right = b[sort.key]

      // Nulls always sort last regardless of direction. An empty cell is not
      // "the smallest value", it's an absence.
      if (left === null || left === undefined) return 1
      if (right === null || right === undefined) return -1

      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))

      return sort.direction === 'asc' ? comparison : -comparison
    })
    return rows
  }, [filtered, sort])

  const pageCount = Math.max(Math.ceil(sorted.length / PAGE_SIZE), 1)
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const activeFilters = [countryFilter, orgFilter, visaFilter, outcomeFilter, query].filter(Boolean)

  const toggleSort = (key) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
    setPage(0)
  }

  const clearFilters = () => {
    setQuery('')
    setCountryFilter('')
    setOrgFilter('')
    setVisaFilter('')
    setOutcomeFilter('')
    setPage(0)
  }

  return (
    <>
      <PageHeader
        title="Database"
        description={`Every field the extractor pulled out of the fellowship reports. ${records.length} records, exportable as CSV.`}
        actions={
          <Button variant="primary" icon={Download} onClick={() => downloadCsv(sorted)} disabled={sorted.length === 0}>
            Download CSV{activeFilters.length > 0 ? ` (${sorted.length})` : ''}
          </Button>
        }
      />

      <Toolbar className="db-toolbar">
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(0)
          }}
          label="Search records"
          placeholder="Search any field, including complication notes and advice"
        />
        <Select label="Country" value={countryFilter} onChange={(v) => { setCountryFilter(v); setPage(0) }} options={countries} />
        <Select label="Organisation" value={orgFilter} onChange={(v) => { setOrgFilter(v); setPage(0) }} options={organizations} />
        <Select label="Visa type" value={visaFilter} onChange={(v) => { setVisaFilter(v); setPage(0) }} options={visaTypes} />
        <Select
          label="Outcome"
          value={outcomeFilter}
          onChange={(v) => { setOutcomeFilter(v); setPage(0) }}
          options={[
            { value: 'Yes', label: 'Complication' },
            { value: 'No', label: 'Clean' },
          ]}
        />
        {activeFilters.length > 0 && (
          <Button variant="ghost" icon={X} onClick={clearFilters}>
            Clear
          </Button>
        )}
      </Toolbar>

      <div className="db-summary">
        <span>
          Showing <strong className="tnum">{pageRows.length}</strong> of{' '}
          <strong className="tnum">{sorted.length}</strong>
          {sorted.length !== records.length && <> filtered from {records.length}</>}
        </span>
      </div>

      <Card className="db-card">
        {sorted.length === 0 ? (
          <EmptyState
            icon={activeFilters.length > 0 ? SearchIcon : FileWarning}
            title={activeFilters.length > 0 ? 'No records match these filters' : 'No records loaded'}
            description={
              activeFilters.length > 0
                ? 'Try removing a filter or searching for a different term.'
                : 'Run the extraction pipeline and load the results, then refresh.'
            }
            action={
              activeFilters.length > 0 ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear all filters
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {COLUMNS.map((column) => {
                    const isSorted = sort.key === column.key
                    return (
                      <th
                        key={column.key}
                        style={{ minWidth: column.width }}
                        className={column.align ? `is-${column.align}` : undefined}
                        aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        {column.sortable ? (
                          <button type="button" className="th-sort" onClick={() => toggleSort(column.key)}>
                            {column.label}
                            {isSorted ? (
                              sort.direction === 'asc' ? (
                                <ChevronUp size={12} strokeWidth={2.6} />
                              ) : (
                                <ChevronDown size={12} strokeWidth={2.6} />
                              )
                            ) : (
                              <ChevronsUpDown size={12} strokeWidth={2} className="th-sort__idle" />
                            )}
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((record) => {
                  const isExpanded = Boolean(expanded[record.id])
                  return (
                    <Fragment key={record.id}>
                      <tr className={record.isSuspectedDuplicate ? 'is-duplicate' : undefined}>
                        <td>
                          <span className="cell-strong">{record.country}</span>
                        </td>
                        <td>
                          <span className="cell-wrap" title={record.organization}>
                            {record.organization}
                          </span>
                          {record.isSuspectedDuplicate && (
                            <Badge tone="warning" size="sm">Duplicate?</Badge>
                          )}
                        </td>
                        <td>
                          <span className="cell-wrap" title={record.visaTypeRaw ?? record.visaType}>
                            {record.visaType}
                          </span>
                        </td>
                        <td className="is-center">{record.year}</td>
                        <td className="cell-muted">{record.timing === 'Unknown' ? '—' : record.timing}</td>
                        <td className="cell-muted">{record.whoPaid === 'Unknown' ? '—' : record.whoPaid}</td>
                        <td>
                          <OutcomeCell record={record} />
                        </td>
                        <td className="is-center">
                          {record.challengeDetails && (
                            <button
                              type="button"
                              className="detail-toggle"
                              onClick={() =>
                                setExpanded((current) => ({
                                  ...current,
                                  [record.id]: !current[record.id],
                                }))
                              }
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded
                                  ? `Hide details for ${record.organization}`
                                  : `Show details for ${record.organization}`
                              }
                              title={isExpanded ? 'Hide details' : 'Show details'}
                            >
                              {isExpanded ? (
                                <ChevronUp size={14} strokeWidth={2.4} />
                              ) : (
                                <ChevronDown size={14} strokeWidth={2.4} />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="detail-row">
                          <td colSpan={COLUMNS.length}>
                            <div className="detail-row__inner">
                              <div>
                                <p className="detail-row__label">What went wrong</p>
                                <p className="detail-row__text">{record.challengeDetails}</p>
                              </div>
                              {record.advice && (
                                <div>
                                  <p className="detail-row__label">Advice for future Fellows</p>
                                  <p className="detail-row__text">{record.advice}</p>
                                </div>
                              )}
                              <p className="detail-row__source">Source: {record.file}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pageCount > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={safePage === 0}>
            Previous
          </Button>
          <span className="pagination__status tnum">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
            disabled={safePage >= pageCount - 1}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  )
}
