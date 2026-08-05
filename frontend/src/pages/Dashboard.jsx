/* ============================================================================
   Dashboard
   ----------------------------------------------------------------------------
   Read top to bottom, this page answers: how bad is it, where is it worst, who
   is responsible, which route works, and how much of it we can trust.
   Each card states its question in its subtitle.
   ========================================================================== */

import {
  AlertTriangle, ArrowUpRight, Building2, ClipboardList, Coins,
  FileWarning, Globe2, ShieldCheck, TrendingUp, Split, Plane,
} from 'lucide-react'
import {
  Badge, Card, CardBody, CardHeader, EmptyState, ExpandableList,
  Notice, PageHeader, RateBar, RiskBadge, SectionHeader, Stat,
} from '../components/ui'
import { ComparisonRows, CompositionBar, RankedBarChart, TrendChart } from '../components/charts'
import {
  buildInsights, costCoverage, dataQuality, overview, rankedProfiles,
  riskLevel, timingComparison, visaTypeBreakdown, yearlyTrend,
} from '../lib/analytics'
import './pages.css'

const INSIGHT_ICON = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  success: ShieldCheck,
  info: TrendingUp,
}

function InsightCard({ insight }) {
  const Icon = INSIGHT_ICON[insight.tone] ?? TrendingUp
  return (
    <article className={`insight insight--${insight.tone}`}>
      <div className="insight__icon">
        <Icon size={15} strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="insight__content">
        <h3 className="insight__title">{insight.title}</h3>
        <p className="insight__detail">{insight.detail}</p>
      </div>
      <div className="insight__metric tnum">{insight.metric}</div>
    </article>
  )
}

/**
 * Marks where a ranking stops being well-evidenced. Everything below this line
 * rests on one or two reports, so it is separated rather than silently mixed
 * in with findings that have real weight behind them.
 */
function lowConfidenceDivider(items) {
  const firstLowIndex = items.findIndex((item) => item.confidence === 'low')

  return (item, index) =>
    index === firstLowIndex && firstLowIndex > 0 ? (
      <p className="tier-divider">Fewer than 3 reports</p>
    ) : null
}

/** One row in a ranking list. Clicking it opens that entity in Lookup. */
function RankRow({ profile, onExplore, showMeta }) {
  const level = riskLevel(profile.rate)

  return (
    <button type="button" className="rank-row" onClick={() => onExplore(profile.name)}>
      <div className="rank-row__main">
        <span className="rank-row__name" title={profile.name}>
          {profile.name}
        </span>
        <RiskBadge rate={profile.rate} level={level} confidence={profile.confidence} />
      </div>
      <RateBar rate={profile.rate} level={level} />
      <div className="rank-row__meta">
        <span>
          {profile.affectedCount} of {profile.knownCount} reported complications
        </span>
        {showMeta && profile.isInconsistent && (
          <Badge tone="warning" size="sm" icon={Split}>
            {profile.visaTypes.length} visa types
          </Badge>
        )}
        <ArrowUpRight size={13} strokeWidth={2} className="rank-row__go" aria-hidden="true" />
      </div>
    </button>
  )
}

function InconsistencyRow({ profile, onExplore }) {
  return (
    <button type="button" className="rank-row" onClick={() => onExplore(profile.name)}>
      <div className="rank-row__main">
        <span className="rank-row__name" title={profile.name}>
          {profile.name}
        </span>
        <Badge tone="warning">{profile.visaTypes.length} types</Badge>
      </div>
      <div className="rank-row__chips">
        {profile.visaTypes.map((type) => (
          <span key={type} className="chip">
            {type}
          </span>
        ))}
      </div>
      <div className="rank-row__meta">
        <span>
          Across {profile.total} {profile.total === 1 ? 'report' : 'reports'}
        </span>
        <ArrowUpRight size={13} strokeWidth={2} className="rank-row__go" aria-hidden="true" />
      </div>
    </button>
  )
}

export default function Dashboard({ records, onExplore }) {
  if (records.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <EmptyState
            icon={FileWarning}
            title="No reports loaded"
            description="Run the extraction pipeline and load the results, then refresh this page."
          />
        </Card>
      </>
    )
  }

  const stats = overview(records)
  const insights = buildInsights(records)
  const countries = rankedProfiles(records, 'country')
  const organizations = rankedProfiles(records, 'organization')
  const visaTypes = visaTypeBreakdown(records)
  const timing = timingComparison(records)
  const cost = costCoverage(records)
  const trend = yearlyTrend(records)
  const quality = dataQuality(records)

  const countriesWithRisk = countries.filter((c) => c.rate !== null && c.rate > 0)
  const orgsWithRisk = organizations.filter((o) => o.rate !== null && o.rate > 0)
  const inconsistentCountries = countries.filter((c) => c.isInconsistent)
  const inconsistentOrgs = organizations.filter((o) => o.isInconsistent)

  const overallLevel = riskLevel(stats.rate)
  const cohortLabel =
    stats.cohorts.length === 1 ? `the ${stats.cohorts[0]} cohort` : `${stats.cohorts.length} cohorts`

  // A route used once, with no problem reported, is not evidence that the route
  // is safe. Those are drawn as neutral rather than green so the chart cannot
  // be read as a recommendation it can't support.
  const visaChartData = visaTypes
    .filter((type) => type.name !== 'Unrecorded')
    .map((type) => ({
      ...type,
      level: type.confidence === 'low' ? 'unknown' : riskLevel(type.rate),
    }))

  const evidencedRoutes = visaChartData.filter((type) => type.level !== 'unknown')

  const payerColors = {
    Organization: 'var(--success)',
    Fellow: 'var(--warning)',
    'No Cost': 'var(--chart-2)',
    Split: 'var(--chart-4)',
    PIAF: 'var(--chart-5)',
  }

  return (
    <>
      <PageHeader
        title="Visa outcomes across the fellowship"
        description={`Drawn from ${stats.totalReports} fellowship reports covering ${cohortLabel}, ${stats.countries} host countries and ${stats.organizations} host organisations. Use this to advise Fellows before they apply.`}
      />

      {/* ── Headline figures ────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-hero">
          <div className="kpi-hero__body">
            <p className="kpi-hero__label">Complication rate</p>
            <p className={`kpi-hero__value tnum kpi-hero__value--${overallLevel}`}>
              {stats.rate === null ? '—' : `${stats.rate}%`}
            </p>
            <p className="kpi-hero__context">
              {stats.affectedCount} of {stats.knownCount} Fellows with a recorded outcome hit a
              visa or permit problem
              {stats.rate
                ? `. That is about one in every ${Math.max(Math.round(100 / stats.rate), 1)} placements.`
                : '.'}
            </p>
          </div>
          <div className="kpi-hero__aside">
            <RiskBadge rate={stats.rate} level={overallLevel} showLabel />
          </div>
        </div>

        <Stat
          label="Reports analysed"
          value={stats.totalReports}
          icon={ClipboardList}
          context={`${stats.knownCount} state a clear outcome`}
        />
        <Stat
          label="Host countries"
          value={stats.countries}
          icon={Globe2}
          context={`${countriesWithRisk.length} with reported complications`}
        />
        <Stat
          label="Host organisations"
          value={stats.organizations}
          icon={Building2}
          context={`${inconsistentOrgs.length} using inconsistent visa types`}
        />
        <Stat
          label="Visa routes in use"
          value={stats.visaTypes}
          icon={Plane}
          context={`Most common: ${visaChartData[0]?.name ?? '—'}`}
        />
      </div>

      {/* ── Executive summary ───────────────────────────────────────────── */}
      {insights.length > 0 && (
        <section className="section">
          <SectionHeader
            title="What the reports are telling us"
            description="Calculated from the reports currently loaded."
          />
          <div className="insight-grid">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* ── Where the risk sits ─────────────────────────────────────────── */}
      <section className="section">
        <SectionHeader
          title="Where the risk sits"
          description="Ranked by the share of Fellows who reported a visa complication. Select any row to open it in Lookup."
        />
        <div className="grid grid--2">
          <Card>
            <CardHeader
              icon={Globe2}
              title="Host countries by complication rate"
              subtitle="Which destinations should we brief Fellows about most carefully?"
            />
            <CardBody>
              {countriesWithRisk.length === 0 ? (
                <EmptyState compact title="No complications recorded" description="No country currently shows a reported visa complication." />
              ) : (
                <ExpandableList
                  items={countriesWithRisk}
                  previewCount={4}
                  expandLabel="countries"
                  divider={lowConfidenceDivider(countriesWithRisk)}
                  renderItem={(profile) => (
                    <RankRow
                      key={profile.name}
                      profile={profile}
                      showMeta
                      onExplore={(name) => onExplore('country', name)}
                    />
                  )}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={Building2}
              title="Host organisations by complication rate"
              subtitle="Which partners repeatedly struggle to get their Fellows documented?"
            />
            <CardBody>
              {orgsWithRisk.length === 0 ? (
                <EmptyState compact title="No complications recorded" description="No organisation currently shows a reported visa complication." />
              ) : (
                <ExpandableList
                  items={orgsWithRisk}
                  previewCount={4}
                  expandLabel="organisations"
                  divider={lowConfidenceDivider(orgsWithRisk)}
                  renderItem={(profile) => (
                    <RankRow
                      key={profile.name}
                      profile={profile}
                      showMeta
                      onExplore={(name) => onExplore('organization', name)}
                    />
                  )}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Inconsistency ───────────────────────────────────────────────── */}
      <section className="section">
        <SectionHeader
          title="Inconsistent visa routing"
          description="Where Fellows going to the same place were put on different visas. Usually a sign there is no agreed process." 
        />
        <div className="grid grid--2">
          <Card>
            <CardHeader
              icon={Split}
              title="Countries using more than one visa type"
              subtitle="Are we routing Fellows into the same country inconsistently?"
            />
            <CardBody>
              {inconsistentCountries.length === 0 ? (
                <EmptyState compact title="No inconsistency found" description="Every country used a single visa type across its reports." />
              ) : (
                <ExpandableList
                  items={inconsistentCountries}
                  previewCount={3}
                  expandLabel="countries"
                  renderItem={(profile) => (
                    <InconsistencyRow
                      key={profile.name}
                      profile={profile}
                      onExplore={(name) => onExplore('country', name)}
                    />
                  )}
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={Building2}
              title="Organisations using more than one visa type"
              subtitle="Which partners lack a repeatable visa process?"
            />
            <CardBody>
              {inconsistentOrgs.length === 0 ? (
                <EmptyState compact title="No inconsistency found" description="Every organisation used a single visa type across its reports." />
              ) : (
                <ExpandableList
                  items={inconsistentOrgs}
                  previewCount={3}
                  expandLabel="organisations"
                  renderItem={(profile) => (
                    <InconsistencyRow
                      key={profile.name}
                      profile={profile}
                      onExplore={(name) => onExplore('organization', name)}
                    />
                  )}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Visa routes ─────────────────────────────────────────────────── */}
      <section className="section">
        <Card>
          <CardHeader
            icon={Plane}
            title="Which visa routes are actually used"
            subtitle="Bar length is how often a route was used. Colour shows how often it ran into trouble. Routes used fewer than three times stay grey, because one clean report is not enough to judge a route."
          />
          <CardBody>
            <RankedBarChart data={visaChartData} valueLabel="placements" height={Math.max(visaChartData.length * 34 + 40, 200)} />
            <div className="legend">
              <span className="legend__item"><i style={{ background: 'var(--success)' }} />Low complication rate</span>
              <span className="legend__item"><i style={{ background: 'var(--warning)' }} />Moderate</span>
              <span className="legend__item"><i style={{ background: 'var(--danger)' }} />High</span>
              <span className="legend__item"><i style={{ background: 'var(--n-300)' }} />Too few reports to judge</span>
            </div>
            <p className="card-note">
              {evidencedRoutes.length === 0
                ? 'No route has been used often enough to judge yet.'
                : `Only ${evidencedRoutes.length} of ${visaChartData.length} routes have been used enough times to judge: ${evidencedRoutes.map((route) => route.name).join(', ')}.`}
            </p>
          </CardBody>
        </Card>
      </section>

      {/* ── Process questions ───────────────────────────────────────────── */}
      <section className="section">
        <div className="grid grid--2">
          <Card>
            <CardHeader
              icon={TrendingUp}
              title="Does applying before departure help?"
              subtitle="Complication rate by when the visa was obtained."
            />
            <CardBody>
              <ComparisonRows
                rows={[
                  {
                    label: 'Obtained before arrival',
                    rate: timing.before.rate,
                    count: timing.before.count,
                    color: 'var(--success)',
                  },
                  {
                    label: 'Obtained after arrival',
                    rate: timing.after.rate,
                    count: timing.after.count,
                    color: 'var(--danger)',
                  },
                ]}
              />
              <p className="card-note">
                {timing.difference === null
                  ? 'Not enough recorded timings to compare the two approaches.'
                  : timing.difference > 0
                    ? `Fellows who sorted their visa before travelling reported ${timing.difference} percentage points fewer complications.`
                    : `Applying after arrival looks ${Math.abs(timing.difference)} points better here. Worth checking before acting on it.`}
                {timing.unknown > 0 && ` Timing was not recorded in ${timing.unknown} reports.`}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={Coins}
              title="Who pays for the visa"
              subtitle="Whether the cost lands on the Fellow or the host organisation."
            />
            <CardBody>
              <CompositionBar
                total={cost.knownCount}
                segments={cost.byPayer.map((payer) => ({
                  label: payer.name,
                  count: payer.count,
                  color: payerColors[payer.name],
                }))}
              />
              <p className="card-note">
                {cost.unknownCount > 0 && `Who paid was not stated in ${cost.unknownCount} reports.`}
              </p>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Trend + data quality ────────────────────────────────────────── */}
      <section className="section">
        <div className="grid grid--2">
          <Card>
            <CardHeader
              icon={TrendingUp}
              title="Complication rate by cohort"
              subtitle="Is the visa situation getting better or worse over time?"
            />
            <CardBody>
              <TrendChart data={trend} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={FileWarning}
              title="How much of this can we trust?"
              subtitle="What is missing from the underlying reports."
              action={<Badge tone={quality.completeness >= 75 ? 'success' : 'warning'}>{quality.completeness}% complete</Badge>}
            />
            <CardBody>
              {quality.issues.length === 0 ? (
                <EmptyState compact icon={ShieldCheck} title="No data quality issues found" />
              ) : (
                <ul className="quality-list">
                  {quality.issues.map((issue) => (
                    <li key={issue.id} className="quality-item">
                      <Badge tone={issue.severity === 'warning' ? 'warning' : 'neutral'}>
                        {issue.count}
                      </Badge>
                      <div>
                        <p className="quality-item__label">{issue.label}</p>
                        <p className="quality-item__description">{issue.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      {quality.duplicates.length > 0 && (
        <Notice tone="warning" title="Suspected duplicate reports are included in these figures">
          {quality.duplicates.map((record) => (
            <p key={record.id}>
              <strong>{record.file}</strong> carries identical content to{' '}
              <strong>{record.duplicateOf}</strong>. Nothing was deleted. If it really is one
              report submitted twice, remove the extra PDF from your reports folder and re-run the
              pipeline.
            </p>
          ))}
        </Notice>
      )}
    </>
  )
}
