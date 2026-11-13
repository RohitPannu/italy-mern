# Data audit

Run `node server/scripts/audit.js` from the repository root. The script writes `server/data/audit-report.csv` and prints a summary.

The script checks:
- course names that appear truncated or incomplete
- missing or malformed links
- entries missing required provenance fields
- live HTTP status for link values

The CSV is for manual review only. The script never changes source data.
