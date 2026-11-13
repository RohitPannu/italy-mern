import { useState, useEffect, useMemo } from 'react';
import { load, sendLead } from './api.js';
import { APPLICATION_STEPS, SCHOLARSHIP_ROUTES } from './studentGuide.js';
import StudentAccessLink from './StudentAccessLink.jsx';

const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const jump = id => document.getElementById(id)?.scrollIntoView();
const CHECK = ['Passport valid for the whole study period', 'Degree and transcripts attested in Pakistan, with apostille', 'Certified translation of academic documents', 'CIMEA statement of comparability (if the university asks)', 'English proof such as IELTS or TOEFL (if the program asks)', 'CV and motivation letter', 'Family income, tax and property records for ISEE Parificato', 'NADRA family registration certificate, translated and legalised', 'Proof of funds for the visa'];
const FAQ = [
  ['Is the DSU grant really fully funded?', 'It can cover a yearly payment, tuition waiver, meals and housing, but amounts depend on the region and your family income, and it is not guaranteed. You must be admitted first.'],
  ['Do I need IELTS for the DSU grant?', 'The DSU application asks for financial documents, not language scores. Your program may still require English proof for admission.'],
  ['Are these programs really taught in English?', 'Yes, the list contains master\'s programs offered in English. Confirm the teaching language on each course page.'],
  ['Where do I find deadlines and fees?', 'On each university\'s official admissions page. They change every year, so this site links to sources instead of promising dates.'],
  ['Some courses have no link. Why?', 'The source list did not include a working link for them. Search the course name on the university website.']];

function Hero({ d, onPick, counts }) {
  const [q, setQ] = useState(''), [open, setOpen] = useState(false), [i, setI] = useState(-1);
  const sug = useMemo(() => {
    const t = q.trim().toLowerCase(); if (!t) return [];
    return [...d.meta.unis.filter(x => x.name.toLowerCase().includes(t)).slice(0, 3).map(x => ({ n: x.name, t: 'University', u: 1 })),
      ...d.programs.filter(x => x.course.toLowerCase().includes(t)).slice(0, 4).map(x => ({ n: x.course, t: x.university }))];
  }, [q, d]);
  const pick = x => { setOpen(false); onPick(x, q); };
  const key = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setI(v => (v + (e.key === 'ArrowDown' ? 1 : -1) + sug.length) % sug.length); }
    else if (e.key === 'Enter') pick(i >= 0 ? sug[i] : null); else if (e.key === 'Escape') setOpen(false);
  };
  return <header className="hero" id="top"><div className="w">
    <h1>Study in Italy on a scholarship, step by step</h1>
    <p>Built for Pakistani students from low and middle income families. Compare regions, universities and programs, see deadlines, and follow the full admission process.</p>
    <div className="sb"><input value={q} onChange={e => { setQ(e.target.value); setOpen(true); setI(-1); }} onKeyDown={key} onBlur={() => setOpen(false)} placeholder="Try “data science”, “Bologna” or “finance”" aria-label="Search programs" autoComplete="off" />
      <button onClick={() => pick(null)}>Search</button>
      {open && sug.length > 0 && <div className="sg" style={{ display: 'block' }}>{sug.map((x, k) => <div key={k} className={k === i ? 'on' : ''} onMouseDown={() => pick(x)}><span>{x.n}</span><small>{x.t}</small></div>)}</div>}</div>
    <div className="stats"><div><b>{counts[0]}</b><span>programs</span></div><div><b>{counts[1]}</b><span>universities</span></div><div><b>{counts[2]}</b><span>fields of study</span></div></div></div></header>;
}

export default function App() {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const [F, setF] = useState({ q: '', dept: '', uni: '', region: '', level: 'master', sort: 'course', table: false, shown: 24 });
  const [fav, setFav] = useState(() => new Set(store.get('fav', []))), [open, setOpen] = useState(false), [toast, setToast] = useState('');
  const [done, setDone] = useState(() => new Set(store.get('chk', []))), [msg, setMsg] = useState('');
  useEffect(() => { load().then(setD).catch(e => setErr(e.message)); const t = store.get('theme', null); if (t) document.documentElement.dataset.theme = t; }, []);
  useEffect(() => store.set('fav', [...fav]), [fav]); useEffect(() => store.set('chk', [...done]), [done]);
  const say = m => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const go = p => setF(f => ({ ...f, shown: 24, ...p }));
  const R = useMemo(() => d ? Object.fromEntries(d.meta.unis.map(u => [u.name, u.region])) : {}, [d]);
  const level = useMemo(() => d ? d.programs.filter(x => (x.level || 'master') === F.level) : [], [d, F.level]);
  const list = useMemo(() => level.filter(x => (!F.region || R[x.university] === F.region) && (!F.dept || (x.dept || 'Other') === F.dept) && (!F.uni || x.university === F.uni)
    && (!F.q || (x.course + ' ' + x.dept + ' ' + x.university).toLowerCase().includes(F.q.toLowerCase())))
    .sort((a, b) => String(a[F.sort] || '').localeCompare(String(b[F.sort] || '')) || a.course.localeCompare(b.course)), [level, F, R]);
  const depts = useMemo(() => { const c = {}; level.forEach(x => { const k = x.dept || 'Other'; c[k] = (c[k] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 10); }, [level]);
  if (err) return <p style={{ padding: 30 }}>{err}</p>; if (!d) return <p style={{ padding: 30 }}>Loading…</p>;
  const unis = [...new Set(d.meta.unis.map(u => u.name))].sort(), saved = d.programs.filter(x => fav.has(x._id));
  const toggle = id => setFav(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const today = new Date().toISOString().slice(0, 10);
  const theme = () => { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; store.set('theme', r.dataset.theme); };
  const csv = () => { if (!saved.length) return say('Save a program first'); const q = s => '"' + String(s || '').replace(/"/g, '""') + '"';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['Course,Field,University,Link\n' + saved.map(x => [x.course, x.dept, x.university, x.link].map(q).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'my-shortlist.csv'; a.click(); say('Downloaded'); };
  const copy = async () => { if (!saved.length) return say('Save a program first'); try { await navigator.clipboard.writeText(saved.map(x => x.course + ' — ' + x.university).join('\n')); say('Copied'); } catch { say('Copy is blocked here. Use Download CSV.'); } };
  const submit = async e => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    if (saved.length) b.message = (b.message || '') + '\n\nShortlist:\n' + saved.map(x => x.course + ' — ' + x.university).join('\n');
    try { await sendLead(b); setMsg('Thanks! We will reply by email.'); e.target.reset(); } catch (x) { setMsg(x.message); } };
  const heart = x => <button className="heart" aria-pressed={fav.has(x._id)} aria-label={'Save ' + x.course} onClick={() => toggle(x._id)}>{fav.has(x._id) ? '♥' : '♡'}</button>;
  const link = x => x.link ? <StudentAccessLink href={x.link}>Course page</StudentAccessLink> : <span className="tag">No link yet</span>;
  const shown = list.slice(0, F.shown), masters = d.programs.filter(x => (x.level || 'master') === 'master');

  return <>
    <nav><div className="w"><a className="logo" href="#top">Study in Italy</a>
      {[['scholarships', 'Scholarships'], ['programs', 'Programs'], ['deadlines', 'Deadlines'], ['guide', 'Admission steps'], ['contact', 'Contact']].map(([id, t]) => <a key={id} className="l" href={'#' + id}>{t}</a>)}
      <a className="l" href="/student">Student portal</a><a className="l" href="/admin">Admin login</a><button className="ib" onClick={theme} aria-label="Toggle dark mode">◐</button><button className="ib" onClick={() => setOpen(true)}>Shortlist <span className="cnt">{fav.size}</span></button></div></nav>
    <Hero d={d} counts={[masters.length, unis.length, new Set(masters.map(x => x.dept || 'Other')).size]} onPick={(x, q) => { go(x?.u ? { uni: x.n, q: '', dept: '', region: '' } : { q: x ? x.n : q, uni: '', dept: '', region: '' }); jump('programs'); }} />

    <section className="s" id="scholarships"><div className="w"><h2>How funding works in Italy</h2>
      <p className="lead">No scholarship is guaranteed, and nobody can promise you one. These are the three real routes. Anyone who sells a guaranteed scholarship is a scam.</p>
      <div className="grid">{SCHOLARSHIP_ROUTES.map(([t, h, p]) => <article className="card" key={h}><span className="tag">{t}</span><h3>{h}</h3><p>{p}</p></article>)}</div>
      <h2 style={{ marginTop: 36 }}>Funding bodies by region</h2>
      <p className="lead">Each region runs its own right-to-study agency. Deadlines shown are from last year and change every year, so read the current call.</p>
      <div className="grid">{d.meta.regions.map(r => { const n = d.meta.unis.filter(u => u.region === r.name).length;
        return <article className="card" key={r.name}><h3>{r.name}</h3><span className="tag">{n} {n > 1 ? 'universities' : 'university'}</span>
          <div>{r.dsu ? <>Funding body: <b>{r.dsu}</b></> : 'Ask the university\'s right-to-study office'}</div>{r.timing && <small className="tag">Last deadline: {r.timing}</small>}
          <div className="row">{r.url ? <StudentAccessLink href={r.url}>Official site</StudentAccessLink> : <span />}<button className="chip" onClick={() => { go({ region: r.name, uni: '', dept: '', q: '' }); jump('programs'); }}>See programs</button></div></article>; })}</div></div></section>

    <section className="s" id="programs" style={{ background: 'var(--sf)' }}><div className="w"><h2>Programs</h2>
      <p className="lead">Filter by region, university and field. Tap the heart to build your shortlist.</p>
      <div className="chips" style={{ marginBottom: 6 }}>{['master', 'bachelor'].map(l => <button key={l} className="chip" aria-pressed={F.level === l} onClick={() => go({ level: l, dept: '' })}>{l === 'master' ? 'Master\'s' : 'Bachelor\'s'}</button>)}</div>
      <div className="chips"><button className="chip" aria-pressed={!F.dept} onClick={() => go({ dept: '' })}>All fields</button>{depts.map(x => <button key={x} className="chip" aria-pressed={F.dept === x} onClick={() => go({ dept: x })}>{x}</button>)}</div>
      <div className="tools">
        <select aria-label="Region" value={F.region} onChange={e => go({ region: e.target.value })}><option value="">All regions</option>{d.meta.regions.map(r => <option key={r.name}>{r.name}</option>)}</select>
        <select aria-label="University" value={F.uni} onChange={e => go({ uni: e.target.value })}><option value="">All universities</option>{unis.map(u => <option key={u}>{u}</option>)}</select>
        <select aria-label="Sort" value={F.sort} onChange={e => go({ sort: e.target.value })}><option value="course">Sort: course A–Z</option><option value="university">Sort: university</option><option value="dept">Sort: field</option></select>
        <button className="chip" aria-pressed={F.table} onClick={() => go({ table: !F.table })}>{F.table ? 'Card view' : 'Table view'}</button>
        <button className="chip" onClick={() => go({ q: '', dept: '', uni: '', region: '' })}>Clear filters</button><span className="sp">{list.length} programs</span></div>
      {!list.length ? <p className="lead">{F.level === 'bachelor' && !level.length ? 'Bachelor\'s programs have not been added yet. Add them in the admin page with level set to bachelor.' : 'No programs match. Clear a filter or try a shorter search.'}</p>
        : F.table ? <div className="tbl"><table><thead><tr><th>Course</th><th>Field</th><th>University</th><th>Link</th><th /></tr></thead><tbody>{shown.map(x => <tr key={x._id}><td>{x.course}</td><td>{x.dept || '—'}</td><td>{x.university}</td><td>{link(x)}</td><td>{heart(x)}</td></tr>)}</tbody></table></div>
        : <div className="grid">{shown.map(x => <article className="card" key={x._id}><span className="tag">{x.dept || 'Other'}</span><h3>{x.course}</h3><div className="uni">{x.university}</div><div className="row">{link(x)}{heart(x)}</div></article>)}</div>}
      {list.length > F.shown && <button className="more" onClick={() => setF(f => ({ ...f, shown: f.shown + 24 }))}>Show more</button>}</div></section>

    <section className="s" id="deadlines"><div className="w"><h2>Intakes and deadlines</h2>
      <p className="lead">Most master's programs start in autumn (September or October), and some add a spring intake. Dates for 2027/28 are mostly not published yet, so each row shows last year's deadline and links to the official page. National deadline for visa applicants: 31 October 2027 for 2027/28 (reported for the MUR circular). Many universities close much earlier.</p>
      <div className="tbl"><table><thead><tr><th>University</th><th>Region</th><th>Intake</th><th>Deadline 2027/28</th><th>Status</th><th>Last verified</th></tr></thead><tbody>
        {d.meta.unis.filter(u => !F.region || u.region === F.region).map(u => { const verified = u.lastVerified || 'Not announced'; const stale = u.lastVerified && Date.now() - new Date(u.lastVerified + 'T00:00:00').getTime() > 90 * 24 * 60 * 60 * 1000; return <tr key={u.name}><td>{u.name}</td><td>{u.region}</td><td>{u.intake || 'Check official page'}</td><td>{u.deadline || 'Not announced'}</td>
          <td>{u.deadline ? (u.deadline >= today ? 'Open' : 'Closed') : 'Not announced'}</td><td>{verified}{stale && <><br /><span className="tag">Older than 90 days</span></>}{(u.admissionsUrl || u.website || u.source) && <><br /><StudentAccessLink href={u.admissionsUrl || u.website || u.source}>Official university page</StudentAccessLink></>}</td></tr>; })}</tbody></table></div></div></section>

    <section className="s" id="guide" style={{ background: 'var(--sf)' }}><div className="w"><h2>Admission process for Pakistani students</h2>
      <p className="lead">The usual order of steps. Rules differ by university, so confirm each one on the official page.</p>
      <ol className="steps">{APPLICATION_STEPS.map(([t, p]) => <li key={t}><b>{t}</b>{p}</li>)}</ol>
      <h3 style={{ margin: '30px 0 8px' }}>Your document checklist</h3><p className="lead" style={{ marginBottom: 10 }}>{done.size} of {CHECK.length} ready</p>
      {CHECK.map((t, i) => <label key={t} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bd)' }}><input type="checkbox" checked={done.has(i)} onChange={() => setDone(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />{t}</label>)}</div></section>

    <section className="s" id="faq"><div className="w"><h2>Questions</h2><p className="lead">&nbsp;</p>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>

    <section className="s" id="contact" style={{ background: 'var(--sf)' }}><div className="w"><h2>Get in touch</h2><p className="lead">Send your shortlist and a few details. Your saved programs are attached automatically.</p>
      <form className="f" onSubmit={submit}><input name="name" placeholder="Your name" required /><input name="email" type="email" placeholder="Email" required /><input name="whatsapp" placeholder="WhatsApp (optional)" />
        <textarea name="message" rows="3" placeholder="Your degree, grades and target field" /><button className="pri">Send message</button><small>{msg}</small></form></div></section>
    <footer><div className="w">Dates and rules change every year; this site is a guide, not an official source. Verify everything on official university websites before applying.</div></footer>

    <aside className={'dr' + (open ? ' open' : '')} aria-label="Shortlist"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3>Your shortlist</h3><button className="ib" onClick={() => setOpen(false)}>Close</button></div>
      <div className="dl">{saved.length ? saved.map(x => <div key={x._id}><span>{x.course}<small>{x.university}</small></span><button className="heart" aria-pressed="true" onClick={() => toggle(x._id)}>♥</button></div>) : <p className="tag">Nothing saved yet. Tap the heart on any program.</p>}</div>
      <div style={{ display: 'flex', gap: 8 }}><button className="pri" style={{ flex: 1 }} onClick={csv}>Download CSV</button><button className="ib" onClick={copy}>Copy</button></div></aside>
    {toast && <div className="toast" style={{ display: 'block' }}>{toast}</div>}
  </>;
}
