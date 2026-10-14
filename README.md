# ChurnWise Lite
Customer churn analytics dashboard (internship project). React + Vite + Recharts + PapaParse + Lucide. 100% client-side, no backend, no paid services.

## Problem & objectives
Businesses lose revenue to churn. This dashboard cleans customer data, shows data-quality issues, visualizes churn patterns, computes KPIs, and flags active customers with an explainable rule-based risk score.

## Features
Overview KPIs · Data-quality report + cleaned CSV download · 5 interactive charts · rule-based segmentation table with search · filters (contract, payment, churn status, tenure group) · CSV upload with auto/manual column mapping · calculated insights.

## Run locally
```
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Dataset
`public/sample-customers.csv`: **synthetic demonstration data** (120 generated customers + 2 deliberate duplicates, 1 missing tenure/payment, 1 invalid charge). Columns: customerID, Contract, tenure, PaymentMethod, MonthlyCharges, Churn.

## Data-cleaning rules
Column names → lowercase_with_underscores; cell text trimmed; exact duplicates flagged and excluded from analysis (kept in cleaned CSV as `is_duplicate`); tenure/charges converted to numbers, invalid/negative values blanked and counted; missing values reported, never invented. Original upload stays in memory.

## KPI formulas
Churn Rate = churned / total × 100 · Retention Rate = retained / total × 100 · Revenue at Risk = sum of monthly charges of churned customers. Records with unknown churn status are excluded from churn KPIs.

## Rule-based risk score (illustrative, not machine learning)
Month-to-month +2 · tenure < 6 months +2 · electronic check +1 · monthly charges above dataset median +1. Low 0–1, Medium 2–3, High 4–6. Already-churned customers are excluded. Rules whose column is unmapped are skipped and explained.

## Screenshots
Add images to `docs/screenshots/` and reference them here: `![Overview](docs/screenshots/overview.png)`.

## Limitations
Rules are not statistically validated; the churn tab expects Yes/No-style values; the bundle is >500 kB (no code-splitting); not tested on very large files.

## Future enhancements
Validated ML model, date-based trends, code-splitting, unit tests.

## Deployment (Vercel)
Push to GitHub, import the repo at vercel.com (framework: Vite, build `npm run build`, output `dist`). No environment variables needed. Every push to `main` redeploys.

- GitHub repository: _add link here_
- Live demo: _add link here_

## 🌐 Live Demo

**[Click here to visit the live website](https://data-quality-and-exploratory-analys.vercel.app/)**
