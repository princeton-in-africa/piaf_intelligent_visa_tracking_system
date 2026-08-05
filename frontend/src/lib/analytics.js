/* ============================================================================
   Analytics
   ----------------------------------------------------------------------------
   Every function here answers a question a PiAf staff member would actually
   ask before advising a Fellow or a host organisation.

   One rule runs through all of it: with only ~21 reports, a single Fellow's
   experience can look like a 100% failure rate. Rates are therefore always
   returned alongside the sample they came from, and anything under three
   reports is labelled low-confidence rather than being presented as a finding.
   ========================================================================== */

export const LOW_CONFIDENCE_THRESHOLD = 3

/* ── Core measures ─────────────────────────────────────────────────────── */

/** Records where we actually know the outcome (excludes "Unknown"). */
export function knownOutcomes(records) {
  return records.filter((r) => r.hadChallenges === 'Yes' || r.hadChallenges === 'No')
}

/**
 * Share of reports that hit a visa complication, 0–100.
 * Returns null when no outcome is known, never 0, which would read as "good".
 */
export function complicationRate(records) {
  const known = knownOutcomes(records)
  if (known.length === 0) return null
  const affected = known.filter((r) => r.hadChallenges === 'Yes').length
  return Math.round((affected / known.length) * 100)
}

export function confidenceOf(sampleSize) {
  return sampleSize >= LOW_CONFIDENCE_THRESHOLD ? 'ok' : 'low'
}

/** Bucket a rate for colour and language. Order matters: null is not zero. */
export function riskLevel(rate) {
  if (rate === null || rate === undefined) return 'unknown'
  if (rate >= 60) return 'high'
  if (rate >= 30) return 'moderate'
  return 'low'
}

export const RISK_LABELS = {
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  unknown: 'No data',
}

/* ── Grouping ──────────────────────────────────────────────────────────── */

export function groupBy(records, key) {
  const groups = new Map()
  for (const record of records) {
    const value = record[key] || 'Unknown'
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(record)
  }
  return groups
}

export function distinct(records, key) {
  return [...new Set(records.map((r) => r[key]).filter(Boolean))].sort()
}

/**
 * Build a ranked profile for every value of `key` (country or organization).
 * Sorted by complication rate, then by sample size so well-evidenced groups
 * outrank one-off reports at the same rate.
 */
export function rankedProfiles(records, key) {
  const groups = groupBy(records, key)

  const profiles = [...groups.entries()].map(([name, groupRecords]) => {
    const known = knownOutcomes(groupRecords)
    const affected = known.filter((r) => r.hadChallenges === 'Yes')
    const visaTypes = distinct(groupRecords, 'visaType')

    return {
      name,
      records: groupRecords,
      total: groupRecords.length,
      knownCount: known.length,
      affectedCount: affected.length,
      rate: complicationRate(groupRecords),
      confidence: confidenceOf(known.length),
      visaTypes,
      // More than one visa type for the same destination or employer means
      // Fellows were routed differently for the same situation.
      isInconsistent: visaTypes.length > 1,
      countries: distinct(groupRecords, 'country'),
      organizations: distinct(groupRecords, 'organization'),
      years: distinct(groupRecords, 'year'),
    }
  })

  // Sorting by rate alone is actively misleading on a dataset this size: a
  // country with one report and one problem scores 100% and buries the country
  // with four problems out of six. So well-evidenced groups are ranked first,
  // and single-report groups follow as a clearly separated second tier.
  return profiles.sort((a, b) => {
    const aEvidenced = a.confidence === 'ok' ? 0 : 1
    const bEvidenced = b.confidence === 'ok' ? 0 : 1
    if (aEvidenced !== bEvidenced) return aEvidenced - bEvidenced

    const rateA = a.rate ?? -1
    const rateB = b.rate ?? -1
    if (rateB !== rateA) return rateB - rateA

    return b.total - a.total
  })
}

/* ── Distributions ─────────────────────────────────────────────────────── */

/**
 * Visa types ranked by how often they appear, each with its own complication
 * rate. This is what answers "which visa route actually works?".
 */
export function visaTypeBreakdown(records) {
  return [...groupBy(records, 'visaType').entries()]
    .map(([name, groupRecords]) => ({
      name,
      count: groupRecords.length,
      rate: complicationRate(groupRecords),
      confidence: confidenceOf(knownOutcomes(groupRecords).length),
      share: Math.round((groupRecords.length / records.length) * 100),
      records: groupRecords,
    }))
    .sort((a, b) => b.count - a.count)
}

/** Simple count distribution over any field, largest first. */
export function distribution(records, key) {
  return [...groupBy(records, key).entries()]
    .map(([name, groupRecords]) => ({
      name,
      count: groupRecords.length,
      share: records.length ? Math.round((groupRecords.length / records.length) * 100) : 0,
      rate: complicationRate(groupRecords),
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Does applying before departure actually help?
 * Compares complication rates for visas obtained before vs after arrival.
 */
export function timingComparison(records) {
  const before = records.filter((r) => r.timing === 'Before Arrival')
  const after = records.filter((r) => r.timing === 'After Arrival')

  const beforeRate = complicationRate(before)
  const afterRate = complicationRate(after)

  return {
    before: { count: before.length, rate: beforeRate, confidence: confidenceOf(before.length) },
    after: { count: after.length, rate: afterRate, confidence: confidenceOf(after.length) },
    unknown: records.filter((r) => r.timing !== 'Before Arrival' && r.timing !== 'After Arrival').length,
    difference:
      beforeRate !== null && afterRate !== null ? afterRate - beforeRate : null,
  }
}

/** Who bears the cost, the question host organisations get asked most. */
export function costCoverage(records) {
  const counted = records.filter((r) => r.whoPaid && r.whoPaid !== 'Unknown')
  const byPayer = distribution(counted, 'whoPaid')

  return {
    byPayer,
    knownCount: counted.length,
    unknownCount: records.length - counted.length,
    organizationCovered: counted.filter((r) => r.whoPaid === 'Organization').length,
    fellowPaid: counted.filter((r) => r.whoPaid === 'Fellow').length,
  }
}

/**
 * Trend across cohort years.
 * With a single cohort loaded this returns one point, which the UI reports as
 * "not enough history yet" rather than drawing a misleading one-point line.
 */
export function yearlyTrend(records) {
  return [...groupBy(records, 'year').entries()]
    .map(([year, groupRecords]) => ({
      year,
      total: groupRecords.length,
      rate: complicationRate(groupRecords),
    }))
    .sort((a, b) => String(a.year).localeCompare(String(b.year)))
}

/* ── Executive summary ─────────────────────────────────────────────────── */

/**
 * Generate the plain-English findings shown at the top of the dashboard.
 * These are derived from the data every time, never hard-coded, and each one
 * carries the evidence behind it so a reader can judge it.
 */
export function buildInsights(records) {
  const insights = []
  if (records.length === 0) return insights

  const countries = rankedProfiles(records, 'country')
  const organizations = rankedProfiles(records, 'organization')
  const visaTypes = visaTypeBreakdown(records)
  const timing = timingComparison(records)
  const cost = costCoverage(records)

  // 1. The single riskiest destination that has enough reports to trust.
  const evidencedCountry = countries.find(
    (c) => c.confidence === 'ok' && c.rate !== null && c.rate > 0,
  )
  if (evidencedCountry) {
    insights.push({
      id: 'riskiest-country',
      tone: evidencedCountry.rate >= 60 ? 'danger' : 'warning',
      title: `${evidencedCountry.name} has the highest evidenced complication rate`,
      detail: `${evidencedCountry.affectedCount} of ${evidencedCountry.knownCount} Fellows placed in ${evidencedCountry.name} reported visa complications (${evidencedCountry.rate}%).`,
      metric: `${evidencedCountry.rate}%`,
    })
  }

  // 2. Organisations routing Fellows through different visa types.
  // Named explicitly rather than just counted: a reader should never have to
  // go digging through Lookup to find out who "4 organisations" refers to.
  const inconsistentOrgs = organizations.filter((o) => o.isInconsistent)
  if (inconsistentOrgs.length > 0) {
    const worst = inconsistentOrgs[0]
    const names = inconsistentOrgs.map((o) => o.name)
    const namedList =
      names.length <= 4
        ? names.join(', ')
        : `${names.slice(0, 4).join(', ')}, and ${names.length - 4} more`

    insights.push({
      id: 'inconsistent-orgs',
      tone: 'warning',
      title: `${inconsistentOrgs.length} host ${inconsistentOrgs.length === 1 ? 'organisation routes' : 'organisations route'} Fellows through different visa types`,
      detail: `${namedList}. ${worst.name} alone has used ${worst.visaTypes.length} different visa types (${worst.visaTypes.join(', ')}) — usually a sign there is no agreed process for that organisation.`,
      metric: String(inconsistentOrgs.length),
    })
  }

  // 3. Whether applying before departure measurably helps.
  if (timing.difference !== null && Math.abs(timing.difference) >= 10) {
    const beforeIsBetter = timing.difference > 0
    insights.push({
      id: 'timing',
      tone: beforeIsBetter ? 'success' : 'info',
      title: beforeIsBetter
        ? 'Applying before departure is associated with fewer complications'
        : 'Applying after arrival is associated with fewer complications',
      detail: `Fellows who obtained their visa before arrival reported complications ${timing.before.rate}% of the time (n=${timing.before.count}), against ${timing.after.rate}% for those who applied after arriving (n=${timing.after.count}).`,
      metric: `${Math.abs(timing.difference)} pts`,
    })
  }

  // 4. Cost exposure for Fellows.
  if (cost.knownCount > 0) {
    const fellowShare = Math.round((cost.fellowPaid / cost.knownCount) * 100)
    insights.push({
      id: 'cost',
      tone: fellowShare >= 50 ? 'warning' : 'info',
      title: `Fellows paid their own visa costs in ${fellowShare}% of reports where we know who paid`,
      detail: `Who paid was recorded in ${cost.knownCount} of ${records.length} reports.`,
      metric: `${fellowShare}%`,
    })
  }

  // 5. The most-used visa route and how it performs.
  const dominant = visaTypes.find((v) => v.name !== 'Unrecorded')
  if (dominant && dominant.rate !== null) {
    insights.push({
      id: 'dominant-visa',
      tone: 'info',
      title: `${dominant.name} is the most common route, used in ${dominant.count} of ${records.length} placements`,
      detail: `It carries a ${dominant.rate}% complication rate${dominant.confidence === 'low' ? ', though on a small sample' : ''}.`,
      metric: `${dominant.share}%`,
    })
  }

  return insights
}

/* ── Data quality ──────────────────────────────────────────────────────── */

// Organisation names typed by hand drift across cohorts. anonymize.py already
// merges the unambiguous cases (pure capitalisation, name vs. name+acronym).
// These clusters are left unmerged deliberately, because PIAF runs
// country-specific placements and "Baylor Eswatini" vs. "Botswana-Baylor"
// might be genuinely distinct site programmes, not a typo of the same one —
// merging on a guess would silently erase a real distinction. So instead of
// guessing, we just tell a human these names look related and let them judge.
const ORG_NAME_CLUSTER_PATTERNS = [
  { id: 'baylor', label: 'Baylor / BIPAI', test: /baylor|bipai/i },
  { id: 'irc', label: 'International Rescue Committee (IRC)', test: /international rescue committee|\birc\b/i },
]

function possiblyMergedOrganizations(records) {
  const names = distinct(records, 'organization')
  return ORG_NAME_CLUSTER_PATTERNS.map(({ id, label, test }) => ({
    id,
    label,
    names: names.filter((name) => test.test(name)),
  })).filter((cluster) => cluster.names.length > 1)
}

/**
 * What the staff should know about the reliability of what they're looking at.
 * Surfacing this is the difference between a dashboard and a report you trust.
 */
export function dataQuality(records) {
  const duplicates = records.filter((r) => r.isSuspectedDuplicate)
  const missingVisaType = records.filter((r) => r.visaType === 'Unrecorded')
  const unknownOutcome = records.filter(
    (r) => r.hadChallenges !== 'Yes' && r.hadChallenges !== 'No',
  )
  const unknownPayer = records.filter((r) => !r.whoPaid || r.whoPaid === 'Unknown')
  const unknownTiming = records.filter(
    (r) => r.timing !== 'Before Arrival' && r.timing !== 'After Arrival',
  )
  const orgClusters = possiblyMergedOrganizations(records)

  const issues = [
    duplicates.length && {
      id: 'duplicates',
      severity: 'warning',
      label: 'Suspected duplicate reports',
      count: duplicates.length,
      description:
        'These files carry identical content to another report, which double-counts them in the rates below.',
      records: duplicates,
    },
    orgClusters.length && {
      id: 'org-naming',
      severity: 'warning',
      label: 'Organisation names may be split across variants',
      count: orgClusters.reduce((sum, c) => sum + c.names.length, 0),
      description: orgClusters
        .map((c) => `${c.label}: ${c.names.join(' / ')}`)
        .join('. ') + '. Confirm whether these are the same organisation before trusting per-organisation rates.',
      records: [],
    },
    unknownOutcome.length && {
      id: 'outcome',
      severity: 'info',
      label: 'Outcome not recorded',
      count: unknownOutcome.length,
      description: 'Excluded from complication rates rather than counted as successes.',
      records: unknownOutcome,
    },
    missingVisaType.length && {
      id: 'visa-type',
      severity: 'info',
      label: 'Visa type not recorded',
      count: missingVisaType.length,
      description: 'The report did not state a visa type in a form the extractor could read.',
      records: missingVisaType,
    },
    unknownPayer.length && {
      id: 'payer',
      severity: 'info',
      label: 'Who paid not recorded',
      count: unknownPayer.length,
      description: 'Cost-coverage figures are based only on reports where this was stated.',
      records: unknownPayer,
    },
    unknownTiming.length && {
      id: 'timing',
      severity: 'info',
      label: 'Application timing not recorded',
      count: unknownTiming.length,
      description: 'Excluded from the before-versus-after comparison.',
      records: unknownTiming,
    },
  ].filter(Boolean)

  const fieldsPerRecord = 5
  const missingTotal =
    missingVisaType.length + unknownOutcome.length + unknownPayer.length + unknownTiming.length
  const completeness = records.length
    ? Math.round((1 - missingTotal / (records.length * fieldsPerRecord)) * 100)
    : 0

  return { issues, duplicates, completeness }
}

/** Headline numbers for the KPI row. */
export function overview(records) {
  const known = knownOutcomes(records)
  return {
    totalReports: records.length,
    countries: distinct(records, 'country').length,
    organizations: distinct(records, 'organization').length,
    visaTypes: distinct(records, 'visaType').filter((v) => v !== 'Unrecorded').length,
    rate: complicationRate(records),
    affectedCount: known.filter((r) => r.hadChallenges === 'Yes').length,
    knownCount: known.length,
    cohorts: distinct(records, 'year'),
  }
}
