/* ============================================================================
   Lookup
   ----------------------------------------------------------------------------
   Master/detail. Pick a country, organisation or visa route on the left; the
   right pane collects everything known about it: outcome, routes used, what
   went wrong in Fellows' own words, what they advised, and where else the same
   pattern shows up.

   Someone advising a Fellow headed to Kenya should be able to read one panel
   and know what to tell them.
   ========================================================================== */

import { useMemo, useState } from 'react'
import {
  Building2, Compass, FileText, Globe2, Lightbulb, Link2,
  MessageSquareWarning, Plane, Search as SearchIcon,
} from 'lucide-react'
import {
  Badge, Card, CardBody, EmptyState, PageHeader,
  RateBar, RiskBadge, SearchInput, Segmented, Select, Toolbar,
} from '../components/ui'
import { CompositionBar } from '../components/charts'
import {
  complicationRate, distinct, rankedProfiles, riskLevel, RISK_LABELS,
} from '../lib/analytics'
import './pages.css'

const VIEWS = [
  { value: 'country', label: 'Countries', icon: Globe2, field: 'country' },
  { value: 'organization', label: 'Organisations', icon: Building2, field: 'organization' },
  { value: 'visaType', label: 'Visa routes', icon: Plane, field: 'visaType' },
]

/* ── Detail sections ───────────────────────────────────────────────────── */

function DetailStat({ label, value, context }) {
  return (
    <div className="detail-stat">
      <p className="detail-stat__label">{label}</p>
      <p className="detail-stat__value tnum">{value}</p>
      {context && <p className="detail-stat__context">{context}</p>}
    </div>
  )
}

/**
 * A single Fellow's report, shown as evidence rather than as a table row.
 * Their own description of what went wrong is the most useful part.
 */
function ReportEntry({ record }) {
  return (
    <article className="report-entry">
      <header className="report-entry__head">
        <div className="report-entry__title">
          <span className="report-entry__org">{record.organization}</span>
          <span className="report-entry__sep" aria-hidden="true">·</span>
          <span className="report-entry__country">{record.country}</span>
        </div>
        <div className="report-entry__tags">
          <Badge tone="neutral" size="sm">{record.year}</Badge>
          <Badge tone="brand" size="sm">{record.visaType}</Badge>
          <Badge
            tone={record.hadChallenges === 'Yes' ? 'danger' : record.hadChallenges === 'No' ? 'success' : 'neutral'}
            size="sm"
          >
            {record.hadChallenges === 'Yes'
              ? 'Complication'
              : record.hadChallenges === 'No'
                ? 'Clean'
                : 'Unknown'}
          </Badge>
          {record.isSuspectedDuplicate && (
            <Badge tone="warning" size="sm">Suspected duplicate</Badge>
          )}
        </div>
      </header>

      {record.challengeDetails && (
        <div className="report-entry__quote report-entry__quote--issue">
          <MessageSquareWarning size={14} strokeWidth={2} aria-hidden="true" />
          <p>{record.challengeDetails}</p>
        </div>
      )}

      {record.advice && (
        <div className="report-entry__quote report-entry__quote--advice">
          <Lightbulb size={14} strokeWidth={2} aria-hidden="true" />
          <p>{record.advice}</p>
        </div>
      )}

      <footer className="report-entry__meta">
        {record.timing !== 'Unknown' && <span>{record.timing}</span>}
        {record.whoPaid !== 'Unknown' && <span>Paid by: {record.whoPaid}</span>}
        <span className="report-entry__file" title={record.file}>{record.file}</span>
      </footer>
    </article>
  )
}

function DetailPanel({ profile, view, allRecords, onExplore }) {
  const level = riskLevel(profile.rate)
  const records = profile.records

  const visaSplit = useMemo(() => {
    const counts = new Map()
    records.forEach((record) => {
      counts.set(record.visaType, (counts.get(record.visaType) ?? 0) + 1)
    })
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [records])

  const advice = records.map((r) => r.advice).filter(Boolean)
  const issues = records.filter((r) => r.challengeDetails)

  // "Related" means: other entities that share a visa route with this one, so
  // guidance that worked here has a reasonable chance of transferring.
  const related = useMemo(() => {
    if (view === 'visaType') return []
    const field = view === 'country' ? 'organization' : 'country'
    const partnerNames = distinct(records, field)

    const sharedRoute = rankedProfiles(allRecords, view === 'country' ? 'country' : 'organization')
      .filter(
        (candidate) =>
          candidate.name !== profile.name &&
          candidate.visaTypes.some((type) => profile.visaTypes.includes(type)),
      )
      .slice(0, 4)

    return { partners: partnerNames, sharedRoute }
  }, [records, view, allRecords, profile])

  return (
    <div className="detail">
      <header className="detail__header">
        <div>
          <p className="detail__eyebrow">
            {view === 'country' ? 'Host country' : view === 'organization' ? 'Host organisation' : 'Visa route'}
          </p>
          <h2 className="detail__title">{profile.name}</h2>
        </div>
        <RiskBadge rate={profile.rate} level={level} confidence={profile.confidence} showLabel />
      </header>

      {/* Summary in one sentence, so the panel is useful before any scrolling. */}
      <p className="detail__summary">
        {profile.rate === null ? (
          <>No Fellow placed here recorded a clear visa outcome, so no rate can be calculated yet.</>
        ) : (
          <>
            {profile.affectedCount} of {profile.knownCount} Fellows reported a visa complication
            {profile.confidence === 'low' && ', though this rests on fewer than three reports'}.
            {profile.isInconsistent
              ? ` Fellows were routed through ${profile.visaTypes.length} different visa types, so there is no consistent route here.`
              : profile.visaTypes.length === 1
                ? ` All Fellows used the same route: ${profile.visaTypes[0]}.`
                : ''}
          </>
        )}
      </p>

      <div className="detail__stats">
        <DetailStat label="Complication rate" value={profile.rate === null ? '—' : `${profile.rate}%`} context={RISK_LABELS[level]} />
        <DetailStat label="Reports" value={profile.total} context={`${profile.knownCount} with a clear outcome`} />
        <DetailStat label="Visa types used" value={profile.visaTypes.length} context={profile.isInconsistent ? 'Inconsistent' : 'Consistent'} />
        <DetailStat
          label={view === 'country' ? 'Host organisations' : 'Countries'}
          value={view === 'country' ? profile.organizations.length : profile.countries.length}
        />
      </div>

      {visaSplit.length > 1 && (
        <section className="detail__section">
          <h3 className="detail__section-title">Visa routes used here</h3>
          <CompositionBar
            total={records.length}
            segments={visaSplit.map((item) => ({ label: item.label, count: item.count }))}
          />
        </section>
      )}

      {related.sharedRoute?.length > 0 && (
        <section className="detail__section">
          <h3 className="detail__section-title">
            <Link2 size={14} strokeWidth={2} aria-hidden="true" />
            Comparable {view === 'country' ? 'countries' : 'organisations'}
          </h3>
          <p className="detail__section-note">
            These use at least one of the same visa routes, so guidance may transfer.
          </p>
          <div className="related-list">
            {related.sharedRoute.map((candidate) => (
              <button
                key={candidate.name}
                type="button"
                className="related-chip"
                onClick={() => onExplore(candidate.name)}
              >
                <span>{candidate.name}</span>
                <RiskBadge rate={candidate.rate} level={riskLevel(candidate.rate)} confidence={candidate.confidence} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="detail__section">
        <h3 className="detail__section-title">
          <FileText size={14} strokeWidth={2} aria-hidden="true" />
          {records.length} {records.length === 1 ? 'report' : 'reports'}
          {issues.length > 0 && <span className="detail__count-note">{issues.length} describe a problem</span>}
        </h3>
        <div className="report-list">
          {records.map((record) => (
            <ReportEntry key={record.id} record={record} />
          ))}
        </div>
      </section>

      {advice.length > 0 && (
        <section className="detail__section">
          <h3 className="detail__section-title">
            <Lightbulb size={14} strokeWidth={2} aria-hidden="true" />
            What past Fellows advised
          </h3>
          <ul className="advice-list">
            {advice.map((item, index) => (
              <li key={index} className="advice-item">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function Lookup({ records, focus }) {
  const [view, setView] = useState('country')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [handledFocus, setHandledFocus] = useState(null)

  // Arriving from a Dashboard row: switch to that view and open that entity.
  //
  // This adjusts state during render rather than in an effect, which is React's
  // recommended pattern for reacting to a changed prop. It avoids the extra
  // render pass an effect would cause. The parent hands us a fresh object on
  // every request, so clicking the same country twice still registers.
  if (focus && focus !== handledFocus) {
    setHandledFocus(focus)
    setView(focus.type === 'organization' ? 'organization' : focus.type)
    setSelected(focus.name)
    setQuery('')
  }

  const field = VIEWS.find((option) => option.value === view)?.field ?? 'country'

  const scopedRecords = useMemo(() => {
    if (!outcomeFilter) return records
    return records.filter((record) => record.hadChallenges === outcomeFilter)
  }, [records, outcomeFilter])

  const profiles = useMemo(() => rankedProfiles(scopedRecords, field), [scopedRecords, field])

  const visible = useMemo(() => {
    if (!query.trim()) return profiles
    const needle = query.trim().toLowerCase()
    return profiles.filter((profile) => profile.name.toLowerCase().includes(needle))
  }, [profiles, query])

  // Keep a valid selection at all times so the detail pane is never blank
  // just because a filter changed underneath it.
  const activeProfile =
    visible.find((profile) => profile.name === selected) ?? visible[0] ?? null

  const scopeRate = complicationRate(scopedRecords)

  return (
    <>
      <PageHeader
        title="Lookup"
        description="Open a country, host organisation or visa route to see its full history: outcomes, routes, what went wrong in Fellows' own words, and what they advised." 
      />

      <Toolbar className="lookup-toolbar">
        <Segmented
          label="Explore by"
          value={view}
          onChange={(next) => {
            setView(next)
            setSelected(null)
          }}
          options={VIEWS.map(({ value, label, icon }) => ({ value, label, icon }))}
        />
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Search"
          placeholder={`Search ${VIEWS.find((v) => v.value === view)?.label.toLowerCase() ?? ''}`}
        />
        <Select
          label="Outcome"
          value={outcomeFilter}
          onChange={setOutcomeFilter}
          placeholder="All outcomes"
          options={[
            { value: 'Yes', label: 'Had complications' },
            { value: 'No', label: 'No complications' },
          ]}
        />
      </Toolbar>

      {outcomeFilter && (
        <p className="scope-note">
          Showing only reports that {outcomeFilter === 'Yes' ? 'hit a complication' : 'went smoothly'}.{' '}
          {scopedRecords.length} of {records.length} reports.
        </p>
      )}

      <div className="lookup">
        <aside className="lookup__list" aria-label="Results">
          <div className="lookup__list-head">
            <span>
              {visible.length} {visible.length === 1 ? 'result' : 'results'}
            </span>
            {scopeRate !== null && <span className="tnum">{scopeRate}% overall</span>}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={SearchIcon}
              title="Nothing matches"
              description="Try a different search term or clear the outcome filter."
            />
          ) : (
            <div className="lookup__options">
              {visible.map((profile) => {
                const level = riskLevel(profile.rate)
                const isActive = activeProfile?.name === profile.name
                return (
                  <button
                    key={profile.name}
                    type="button"
                    className={`lookup-option ${isActive ? 'is-active' : ''}`}
                    onClick={() => setSelected(profile.name)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span className="lookup-option__row">
                      <span className="lookup-option__name" title={profile.name}>
                        {profile.name}
                      </span>
                      <span className="lookup-option__rate tnum">
                        {profile.rate === null ? '—' : `${profile.rate}%`}
                      </span>
                    </span>
                    <RateBar rate={profile.rate} level={level} />
                    <span className="lookup-option__meta">
                      {profile.total} {profile.total === 1 ? 'report' : 'reports'}
                      {profile.isInconsistent && ' · mixed visa types'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <div className="lookup__detail">
          {activeProfile ? (
            <Card>
              <CardBody className="lookup__detail-body">
                <DetailPanel
                  profile={activeProfile}
                  view={view}
                  allRecords={records}
                  onExplore={setSelected}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={Compass}
                title="Select something to explore"
                description="Choose a country, organisation or visa route from the list to see its full history."
              />
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
