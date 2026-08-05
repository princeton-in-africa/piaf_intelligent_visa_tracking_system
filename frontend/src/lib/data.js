/* ============================================================================
   Data access layer
   ----------------------------------------------------------------------------
   Responsibilities, in order:

   1. Load records from the FastAPI backend, falling back to a bundled snapshot
      so the dashboard is never a blank screen when the backend is down. The UI
      always states which source it is showing, and never presents stale data
      as live.

   2. Clean extraction artifacts defensively. extract.py has been fixed, but
      rows already sitting in Supabase were loaded before that fix and still
      contain the stray "g)" question label. Cleaning here means the dashboard
      is correct today, without waiting for a re-load of the database.

   3. Re-detect suspected duplicate reports. The flags anonymize.py produces are
      local-only (they are not Supabase columns), so the same rule is applied
      here to whatever data actually arrives.
   ========================================================================== */

import snapshot from '../data/snapshot.json'

const API_BASE = 'http://127.0.0.1:8000'
const REQUEST_TIMEOUT_MS = 4000

/* ── Cleaning ──────────────────────────────────────────────────────────── */

// Matches a stray question-numbering label such as "g)" left behind by the
// report form, either alone or trailing the end of a real answer.
const LABEL_ONLY = /^\s*[a-z]\s*\)\s*$/i
const LABEL_TRAILING = /\s*\b[a-z]\s*\)\s*$/i

// Placeholders a Fellow typed instead of leaving the field blank.
const NON_ANSWERS = new Set([
  '?', '??', '-', '--', '.', '..', 'n/a', 'na', 'n.a.',
  'none', 'nothing', 'no comment', 'no comments',
])

/**
 * Turn a free-text field into either meaningful prose or null.
 * Never returns an empty string, so callers can rely on a simple truthy check.
 */
export function cleanNarrative(value) {
  if (typeof value !== 'string') return null

  let text = value.trim()
  if (!text || LABEL_ONLY.test(text)) return null

  text = text.replace(LABEL_TRAILING, '').trim()
  if (!text) return null

  if (NON_ANSWERS.has(text.toLowerCase().replace(/\.$/, ''))) return null

  return text
}

/** Values that mean "we don't know", normalised to null for consistent checks. */
function meaningful(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  if (['unknown', 'other / unknown', 'n/a', 'none'].includes(text.toLowerCase())) {
    return null
  }
  return text
}

/* ── Duplicate detection ───────────────────────────────────────────────── */

function fingerprint(record) {
  const parts = [
    record.country, record.organization, record.visa_type_raw,
    record.challenge_details, record.advice_for_future_fellows,
  ].map((part) => (part ? String(part).trim().toLowerCase() : ''))

  const signature = parts.join('||')

  // A near-empty record would otherwise match every other near-empty record.
  if (signature.replace(/\|/g, '').trim().length < 40) return null
  return signature
}

/**
 * Flag records whose substance duplicates an earlier record.
 * Flags only. A human decides whether it is really the same report twice.
 */
function flagDuplicates(records) {
  const seen = new Map()

  return records.map((record) => {
    const key = fingerprint(record)
    if (key && seen.has(key)) {
      return { ...record, isSuspectedDuplicate: true, duplicateOf: seen.get(key) }
    }
    if (key) seen.set(key, record.file)
    return { ...record, isSuspectedDuplicate: false, duplicateOf: null }
  })
}

/* ── Normalisation ─────────────────────────────────────────────────────── */

function normalizeRecord(record, index) {
  return {
    ...record,
    id: record.id ?? record.file ?? `record-${index}`,
    country: meaningful(record.country) ?? 'Unknown',
    organization: meaningful(record.organization) ?? 'Unknown',
    visaType: meaningful(record.visa_type) ?? 'Unrecorded',
    year: meaningful(record.year) ?? 'Unknown',
    reportType: meaningful(record.report_type) ?? 'Unknown',
    whoPaid: record.who_paid ?? 'Unknown',
    timing: record.before_or_after_arrival ?? 'Unknown',
    hadChallenges: record.had_challenges ?? 'Unknown',
    challengeDetails: cleanNarrative(record.challenge_details),
    advice: cleanNarrative(record.advice_for_future_fellows),
    obtainedWhere: cleanNarrative(record.obtained_where),
    visaTypeRaw: cleanNarrative(record.visa_type_raw),
  }
}

export function prepareRecords(rawRecords) {
  if (!Array.isArray(rawRecords)) return []
  return flagDuplicates(rawRecords.map(normalizeRecord))
}

/* ── Loading ───────────────────────────────────────────────────────────── */

/**
 * Fetch live records, falling back to the bundled snapshot.
 * Always resolves. The caller renders a status note based on `source`.
 *
 * source is one of:
 *   'live':     served by the FastAPI backend
 *   'snapshot': backend unreachable, showing the file bundled at build time
 */
export async function loadRecords() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE}/records`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Backend responded ${response.status}`)

    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('Backend returned an unexpected shape')

    // An empty table is a real answer, but the snapshot is more useful than a
    // blank dashboard, so treat it as a fallback case and say so.
    if (data.length === 0) {
      return { records: prepareRecords(snapshot), source: 'snapshot', reason: 'The database returned no rows.' }
    }

    return { records: prepareRecords(data), source: 'live', reason: null }
  } catch (error) {
    const reason =
      error.name === 'AbortError'
        ? 'The backend did not respond.'
        : `Could not reach the backend (${error.message}).`
    return { records: prepareRecords(snapshot), source: 'snapshot', reason }
  } finally {
    clearTimeout(timer)
  }
}
