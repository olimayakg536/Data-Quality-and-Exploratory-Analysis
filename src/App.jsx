import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { LayoutDashboard, ShieldCheck, BarChart3, Users, Lightbulb, Upload, Download, RotateCcw } from 'lucide-react'
import { FIELDS, detect, stdName, cleanData, buildRows, rateBy, riskScore, ACTIONS, GROUPS, pct, median } from './utils/analytics'

const TABS = [['overview', 'Overview', LayoutDashboard], ['quality', 'Data Quality', ShieldCheck], ['churn', 'Churn Analysis', BarChart3],
  ['risk', 'Segmentation', Users], ['insights', 'Recommendations', Lightbulb], ['upload', 'Upload CSV', Upload]]
const LABELS = { id: 'Customer ID', churn: 'Churn status', contract: 'Contract', tenure: 'Tenure (months)', payment: 'Payment method', charges: 'Monthly charges' }
const NOFILTER = { contract: 'All', payment: 'All', churn: 'All', group: 'All' }
const money = (n) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const uniq = (rows, k) => [...new Set(rows.map((r) => r[k]).filter((v) => v != null))].sort()

export default function App() {
  const [tab, setTab] = useState('overview')
  const [raw, setRaw] = useState(null)
  const [source, setSource] = useState('')
  const [map, setMap] = useState({})
  const [filters, setFilters] = useState(NOFILTER)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  function load(rows, name) {
    if (!rows.length) return setError('The file has no data rows.')
    setError(''); setRaw(rows); setSource(name); setFilters(NOFILTER)
    setMap(detect(Object.keys(rows[0]).map(stdName)))
  }
  useEffect(() => {
    fetch('/sample-customers.csv').then((r) => r.text())
      .then((t) => load(Papa.parse(t, { header: true, skipEmptyLines: true }).data, 'Synthetic demonstration data'))
      .catch(() => setError('Could not load the sample data.'))
  }, [])

  function onFile(e) {
    const f = e.target.files[0]; if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) return setError('Please upload a .csv file.')
    if (!f.size) return setError('The file is empty.')
    Papa.parse(f, { header: true, skipEmptyLines: true, complete: (res) => {
      if (!res.meta.fields || res.meta.fields.length < 2) return setError('Could not read columns. Is this a comma-separated CSV with a header row?')
      load(res.data, f.name)
    }, error: () => setError('Could not read this file.') })
    e.target.value = ''
  }

  const cleaned = useMemo(() => (raw ? cleanData(raw, map) : null), [raw, map])
  const all = useMemo(() => (cleaned ? buildRows(cleaned.rows, map) : []), [cleaned, map])
  const rows = useMemo(() => all.filter((r) =>
    (filters.contract === 'All' || r.contract === filters.contract) && (filters.payment === 'All' || r.payment === filters.payment) &&
    (filters.group === 'All' || r.group === filters.group) &&
    (filters.churn === 'All' || (filters.churn === 'Churned' ? r.churned === true : r.churned === false))), [all, filters])

  const known = rows.filter((r) => r.churned != null)
  const churned = known.filter((r) => r.churned).length
  const has = (f) => !!map[f]
  const med = median(all.map((r) => r.charges).filter((v) => v != null))
  const active = rows.filter((r) => r.churned !== true).map((r) => ({ ...r, ...riskScore(r, med) }))
  const shown = active.filter((r) => String(r.id).toLowerCase().includes(search.toLowerCase())).slice(0, 100)
  const revenue = rows.reduce((s, r) => s + (r.charges || 0), 0)
  const atRisk = rows.filter((r) => r.churned).reduce((s, r) => s + (r.charges || 0), 0)
  const high = active.filter((r) => r.cat === 'High Risk').length
  const best = (list) => list.length ? [...list].sort((a, b) => b.rate - a.rate)[0] : null
  const byContract = rateBy(rows, 'contract'), byPay = rateBy(rows, 'payment'), byGroup = rateBy(rows, 'group', GROUPS)

  function download() {
    const csv = Papa.unparse(cleaned.rows.map(({ _duplicate, ...r }) => ({ ...r, is_duplicate: _duplicate ? 'yes' : 'no' })))
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'cleaned-customers.csv'; a.click()
  }

  const Chart = ({ title, data, x, children }) => (
    <div className="card"><b>{title}</b>
      {data.length ? <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={x} label={{ value: title.split(' by ')[1] || '', position: 'insideBottom', offset: -2 }} height={40} /><YAxis /><Tooltip /><Legend />{children}</BarChart></ResponsiveContainer></div>
        : <p className="sub">Not available: required column is not mapped or has no data.</p>}</div>)
  const rateBar = <Bar dataKey="rate" name="Churn rate (%)" fill="#2563eb" />
  const filterDefs = [['contract', 'Contract', uniq(all, 'contract')], ['payment', 'Payment method', uniq(all, 'payment')], ['churn', 'Churn status', ['Churned', 'Retained']], ['group', 'Tenure group', GROUPS]]

  if (!raw) return <div className="main">{error ? <div className="err">{error}</div> : 'Loading data…'}</div>
  const pieData = [{ name: 'Churned', value: churned }, { name: 'Retained', value: known.length - churned }]
  const avg = (v) => { const a = known.filter((r) => r.churned === v && r.charges != null); return a.length ? +(a.reduce((s, r) => s + r.charges, 0) / a.length).toFixed(2) : 0 }

  return (
    <div className="app">
      <nav className="side"><h1>ChurnWise Lite</h1>
        {TABS.map(([k, l, I]) => <button key={k} className={'nav' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><I size={16} />{l}</button>)}</nav>
      <main className="main">
        <h2>{TABS.find((t) => t[0] === tab)[1]}</h2>
        <p className="sub">Source: {source}{source.startsWith('Synthetic') && ' (not real customers)'} · {all.length} analysed records</p>
        {error && <div className="err" role="alert">{error}</div>}

        {tab !== 'quality' && tab !== 'upload' && (
          <div className="filters">
            {filterDefs.map(([k, l, opts]) => <label key={k}>{l}<select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}><option>All</option>{opts.map((o) => <option key={o}>{o}</option>)}</select></label>)}
            <button className="btn alt" onClick={() => setFilters(NOFILTER)}><RotateCcw size={14} />Reset filters</button>
          </div>)}

        {tab !== 'quality' && tab !== 'upload' && rows.length === 0 && <div className="note">No customers match the current filters or dataset.</div>}

        {tab === 'overview' && <>
          <div className="grid">
            <div className="card kpi"><span>Total Customers</span><b>{rows.length}</b></div>
            <div className="card kpi"><span>Churn Rate</span><b>{has('churn') && known.length ? pct(churned, known.length).toFixed(1) + '%' : 'N/A'}</b>{!has('churn') && <span>Churn column not mapped</span>}</div>
            <div className="card kpi"><span>Retention Rate</span><b>{has('churn') && known.length ? pct(known.length - churned, known.length).toFixed(1) + '%' : 'N/A'}</b></div>
            <div className="card kpi"><span>Monthly Revenue</span><b>{has('charges') ? money(revenue) : 'N/A'}</b>{has('charges') && has('churn') && <span>Revenue at risk (churned): {money(atRisk)}</span>}</div>
          </div>
          <div className="note">Churn Rate = churned ÷ total × 100. Retention = retained ÷ total × 100. Revenue at risk = monthly charges of customers already churned.</div></>}

        {tab === 'quality' && cleaned && <>
          <div className="grid">
            <div className="card kpi"><span>Total records</span><b>{cleaned.report.records}</b></div>
            <div className="card kpi"><span>Total columns</span><b>{cleaned.report.columns}</b></div>
            <div className="card kpi"><span>Duplicate records</span><b>{cleaned.report.dups}</b></div>
            <div className="card kpi"><span>Invalid numeric values</span><b>{cleaned.report.invalid}</b></div>
          </div>
          <div className="card wrap"><table><thead><tr><th>Column</th><th>Type</th><th>Missing values</th></tr></thead><tbody>
            {Object.keys(cleaned.report.missing).map((c) => <tr key={c}><td>{c}</td><td>{cleaned.report.types[c]}</td><td>{cleaned.report.missing[c]}</td></tr>)}</tbody></table></div>
          <div className="card"><b>Cleaning decisions</b><ul>
            <li>Column names standardized to lowercase_with_underscores.</li>
            <li>{cleaned.report.trimmed} cell(s) had extra spaces trimmed.</li>
            <li>{cleaned.report.dups} exact duplicate row(s) excluded from analysis (kept in the cleaned CSV, flagged is_duplicate).</li>
            <li>{cleaned.report.invalid} non-numeric/negative value(s) in tenure or monthly charges were left blank (not deleted rows).</li>
            <li>Missing values are not filled in; they are reported only. The original upload stays in memory.</li></ul>
            <button className="btn" onClick={download}><Download size={14} />Download cleaned CSV</button></div></>}

        {tab === 'churn' && <div className="charts">
          <div className="card"><b>Churned vs retained customers</b>{has('churn') && known.length ? <div style={{ height: 260 }}><ResponsiveContainer><PieChart><Pie data={pieData} dataKey="value" nameKey="name" label>{pieData.map((d, i) => <Cell key={d.name} fill={i ? '#2563eb' : '#e11d48'} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div> : <p className="sub">Churn column not available.</p>}</div>
          <Chart title="Churn rate by contract type" data={byContract} x="name">{rateBar}</Chart>
          <Chart title="Churn rate by payment method" data={byPay} x="name">{rateBar}</Chart>
          <Chart title="Churn rate by tenure group" data={byGroup} x="name">{rateBar}</Chart>
          <Chart title="Average monthly charges by churn status" data={has('charges') && has('churn') && known.length ? [{ status: 'Churned', avg: avg(true) }, { status: 'Retained', avg: avg(false) }] : []} x="status"><Bar dataKey="avg" name="Avg monthly charges ($)" fill="#1d4ed8" /></Chart>
        </div>}

        {tab === 'risk' && <>
          <div className="note">Rule-based risk indicator (illustrative business rules), not a machine-learning prediction. Churned customers are excluded. Points: month-to-month +2, tenure &lt; 6 months +2, electronic check +1, charges above median ({med.toFixed(2)}) +1.
            {['contract', 'tenure', 'payment', 'charges'].filter((f) => !has(f)).map((f) => <div key={f}>Rule skipped: {LABELS[f]} column is not mapped.</div>)}</div>
          <input type="search" placeholder="Search customer ID…" aria-label="Search customer ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="card wrap" style={{ marginTop: 12 }}><table><thead><tr><th>Customer ID</th><th>Contract</th><th>Tenure</th><th>Monthly charges</th><th>Score</th><th>Category</th><th>Suggested action</th></tr></thead><tbody>
            {shown.map((r, i) => <tr key={i}><td>{r.id}</td><td>{r.contract ?? '—'}</td><td>{r.tenure ?? '—'}</td><td>{r.charges ?? '—'}</td><td>{r.score}</td><td><span className={'tag ' + r.cat.split(' ')[0]}>{r.cat}</span></td><td>{ACTIONS[r.cat]}</td></tr>)}
            {!shown.length && <tr><td colSpan="7">No active customers to show.</td></tr>}</tbody></table>
            <p className="sub">Showing up to 100 of {active.length} active customers.</p></div></>}

        {tab === 'insights' && <div className="card"><ul>
          {rows.length < 30 && <li>Limitation: fewer than 30 records, so rates may be unreliable.</li>}
          {best(byContract) ? <li>Highest churn by contract: <b>{best(byContract).name}</b> ({best(byContract).rate}%).</li> : <li>Contract insight unavailable (missing contract or churn data).</li>}
          {best(byGroup) ? <li>Highest churn by tenure group: <b>{best(byGroup).name}</b> ({best(byGroup).rate}%).</li> : <li>Tenure insight unavailable (missing tenure or churn data).</li>}
          {best(byPay) && <li>Highest churn by payment method: <b>{best(byPay).name}</b> ({best(byPay).rate}%).</li>}
          <li><b>{high}</b> active customer(s) have a High rule-based risk score.</li>
          {best(byContract) && best(byGroup) && <li>A retention campaign could target <b>{best(byContract).name}</b> customers in the <b>{best(byGroup).name}</b> tenure group.</li>}
        </ul></div>}

        {tab === 'upload' && <div className="card">
          <p>Files are processed in your browser only; nothing is uploaded to a server.</p>
          <input type="file" accept=".csv" onChange={onFile} aria-label="Upload CSV" /> <a className="btn alt" href="/sample-customers.csv" download>Download sample CSV</a>
          <h3>Column mapping</h3><p className="sub">Available columns: {Object.keys(cleaned.report.missing).join(', ')}</p>
          <div className="filters">{Object.keys(FIELDS).map((f) => <label key={f}>{LABELS[f]}<select value={map[f] || ''} onChange={(e) => setMap({ ...map, [f]: e.target.value })}><option value="">— not mapped —</option>{Object.keys(cleaned.report.missing).map((c) => <option key={c}>{c}</option>)}</select></label>)}</div></div>}
      </main>
    </div>)
}
