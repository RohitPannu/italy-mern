const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROGRAMS_FILE = path.join(ROOT, 'server', 'data', 'programs.json');
const REPORT_FILE = path.join(ROOT, 'server', 'data', 'audit-report.csv');
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(field); field = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      if (row.some(v => v !== '')) rows.push(row);
      row = []; field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) { row.push(field); if (row.some(v => v !== '')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.trim());
  return rows.map(values => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
}

function auditProgramRows(rows) {
  const report = [];
  rows.forEach((row, index) => {
    const reasons = [];
    const course = String(row.course || '').trim();
    const link = String(row.link || '').trim();
    if (course.length >= 55 && /(?:[A-Za-z])$/.test(course) && course.length <= 70) {
      reasons.push(`Potential truncation: course name is ${course.length} characters and ends at a plausible cut point.`);
    }
    if (!link) reasons.push('Missing URL.');
    else if (!URL_PATTERN.test(link)) reasons.push(`Invalid URL: ${link}`);
    if (!row.academicYear) reasons.push('Missing academicYear.');
    if (!row.language) reasons.push('Missing language.');
    if (!row.duration) reasons.push('Missing duration.');
    if (!row.sourceUrl) reasons.push('Missing sourceUrl.');
    if (!row.lastVerified) reasons.push('Missing lastVerified.');
    if (reasons.length) report.push({ row: index + 1, course, university: row.university || '', link, reason: reasons.join(' | ') });
  });
  return report;
}

async function fetchStatus(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'StudyInItalyDataAudit/1.0' } });
    return { status: response.status, finalUrl: response.url };
  } catch (error) {
    return { status: '', error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const programs = JSON.parse(fs.readFileSync(PROGRAMS_FILE, 'utf8'));
  const rows = auditProgramRows(programs);
  const linkChecks = programs.map((row, index) => ({ row, index, link: String(row.link || '').trim() })).filter(x => URL_PATTERN.test(x.link));
  const concurrency = 5;
  let next = 0;
  const worker = async () => {
    while (next < linkChecks.length) {
      const { row, index, link } = linkChecks[next++];
      const result = await fetchStatus(link);
      if (result.status && result.status >= 400) rows.push({ row: index + 1, course: row.course, university: row.university, link, reason: `HTTP ${result.status}${result.finalUrl ? ` redirect ${result.finalUrl}` : ''}` });
      else if (result.error) rows.push({ row: index + 1, course: row.course, university: row.university, link, reason: `Link check failed: ${result.error}` });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, linkChecks.length) }, worker));
  const header = ['row', 'course', 'university', 'link', 'reason'];
  const content = [header, ...rows].map(r => Array.isArray(r) ? r.map(csvEscape).join(',') : header.map(k => csvEscape(r[k])).join(',')).join('\n');
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, content + '\n', 'utf8');
  console.log(`Audit complete: ${programs.length} programs, ${rows.length} issues, report=${REPORT_FILE}`);
  console.log(rows.slice(0, 30).map(r => `${r.row}: ${r.reason}`).join('\n'));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { auditProgramRows, parseCsv, csvEscape };
