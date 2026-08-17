

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const REQUEST_TIMEOUT_MS = 4000

/* ── Cleaning ──────────────────────────────────────────────────────────── */

const LABEL_ONLY = /^\s*[a-z]\s*\)\s*$/i
const LABEL_TRAILING = /\s*\b[a-z]\s*\)\s*$/i

const NON_ANSWERS = new Set([
  '?', '??', '-', '--', '.', '..', 'n/a', 'na', 'n.a.',
  'none', 'nothing', 'no comment', 'no comments',
])

export function cleanNarrative(value) {
  if (typeof value !== 'string') return null
  let text = value.trim()
  if (!text || LABEL_ONLY.test(text)) return null
  text = text.replace(LABEL_TRAILING, '').trim()
  if (!text) return null
  if (NON_ANSWERS.has(text.toLowerCase().replace(/\.$/, ''))) return null
  return text
}

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
  if (signature.replace(/\|/g, '').trim().length < 40) return null
  return signature
}

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

export async function loadRecords() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE}/records`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Backend responded ${response.status}`)

    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('Backend returned an unexpected shape')

    if (data.length === 0) {
      return { records: [], source: 'live', reason: 'The database returned no rows.' }
    }

    return { records: prepareRecords(data), source: 'live', reason: null }
  } catch (error) {
    const reason =
      error.name === 'AbortError'
        ? 'The backend did not respond.'
        : `Could not reach the backend (${error.message}).`
    return { records: [], source: 'offline', reason }
  } finally {
    clearTimeout(timer)
  }
}