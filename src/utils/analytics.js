// Pure data logic (no UI): clean -> map -> calculate.
export const FIELDS = {
  id: ['customerid', 'id', 'customer'],
  churn: ['churn', 'churned', 'churnstatus', 'exited', 'attrition'],
  contract: ['contract', 'contracttype'],
  tenure: ['tenure', 'tenuremonths', 'months'],
  payment: ['paymentmethod', 'payment'],
  charges: ['monthlycharges', 'monthlycharge', 'monthlyfee'],
}
export const stdName = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
export const GROUPS = ['0-5 mo', '6-12 mo', '13-24 mo', '25+ mo']
export const tenureGroup = (t) => (t == null ? null : t < 6 ? GROUPS[0] : t <= 12 ? GROUPS[1] : t <= 24 ? GROUPS[2] : GROUPS[3])
export const pct = (a, b) => (b ? (a / b) * 100 : 0)
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

export function detect(cols) {
  const map = {}
  for (const f in FIELDS) map[f] = cols.find((c) => FIELDS[f].includes(c.replace(/_/g, ''))) || ''
  return map
}

// Standardize names, trim, flag duplicates (kept in file, excluded from analysis), convert numbers safely.
export function cleanData(raw, map) {
  const cols = Object.keys(raw[0] || {}).map(stdName)
  const numCols = [map.tenure, map.charges].filter(Boolean)
  const missing = {}; cols.forEach((c) => (missing[c] = 0))
  let trimmed = 0, invalid = 0, dups = 0
  const seen = new Set()
  const rows = raw.map((r) => {
    const o = {}
    for (const k in r) {
      const key = stdName(k); let v = r[k]
      if (typeof v === 'string') { const t = v.trim().replace(/\s+/g, ' '); if (t !== v) trimmed++; v = t }
      if (v === '' || v == null) { v = ''; missing[key]++ }
      else if (numCols.includes(key)) { const n = Number(v); if (isNaN(n) || n < 0) { invalid++; v = '' } else v = n }
      o[key] = v
    }
    const sig = JSON.stringify(o); o._duplicate = seen.has(sig); if (o._duplicate) dups++; seen.add(sig)
    return o
  })
  const types = {}
  cols.forEach((c) => { const vals = rows.map((r) => r[c]).filter((v) => v !== ''); types[c] = vals.length && vals.every((v) => !isNaN(Number(v))) ? 'number' : 'text' })
  return { rows, report: { records: raw.length, columns: cols.length, missing, dups, invalid, trimmed, types } }
}

const isChurn = (v) => (v === '' || v == null ? null : ['yes', 'true', '1', 'y', 'churned'].includes(String(v).toLowerCase()))

export function buildRows(rows, map) {
  return rows.filter((r) => !r._duplicate).map((r) => {
    const tenure = map.tenure && r[map.tenure] !== '' ? r[map.tenure] : null
    return {
      id: map.id ? r[map.id] : '', churned: map.churn ? isChurn(r[map.churn]) : null,
      contract: map.contract ? r[map.contract] || null : null, payment: map.payment ? r[map.payment] || null : null,
      tenure, charges: map.charges && r[map.charges] !== '' ? r[map.charges] : null, group: tenureGroup(tenure),
    }
  })
}

export function rateBy(rows, key, order) {
  const g = {}
  rows.filter((r) => r[key] != null && r.churned != null).forEach((r) => { g[r[key]] ??= { name: r[key], customers: 0, churned: 0 }; g[r[key]].customers++; if (r.churned) g[r[key]].churned++ })
  const list = Object.values(g).map((x) => ({ ...x, rate: +pct(x.churned, x.customers).toFixed(1) }))
  return order ? order.map((o) => list.find((x) => x.name === o)).filter(Boolean) : list
}

// Illustrative rule-based score (NOT a machine-learning prediction).
export function riskScore(r, med) {
  let s = 0
  if (r.contract && r.contract.toLowerCase().includes('month')) s += 2
  if (r.tenure != null && r.tenure < 6) s += 2
  if (r.payment && r.payment.toLowerCase() === 'electronic check') s += 1
  if (r.charges != null && r.charges > med) s += 1
  return { score: s, cat: s >= 4 ? 'High Risk' : s >= 2 ? 'Medium Risk' : 'Low Risk' }
}
export const ACTIONS = {
  'High Risk': 'Offer a suitable retention plan or contact the customer.',
  'Medium Risk': 'Review service usage and consider a targeted offer.',
  'Low Risk': 'Maintain regular customer engagement.',
}
