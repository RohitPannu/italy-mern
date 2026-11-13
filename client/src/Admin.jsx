import { useState, useEffect, useCallback } from 'react';
import PasswordField from './PasswordField.jsx';
import { authRequest, readCookie, validateNewPassword } from './authApi.js';

function UniRow({ u, call }) {
  const [v, setV] = useState({ intake: u.intake, deadline: u.deadline, lastCycle: u.lastCycle, source: u.source, city: u.city, website: u.website, admissionsUrl: u.admissionsUrl, dsuApplyUrl: u.dsuApplyUrl, accessibilityNote: u.accessibilityNote, lastVerified: u.lastVerified }), [m, setM] = useState('');
  const set = k => e => setV({ ...v, [k]: e.target.value });
  const save = async () => { try { await call('/universities/' + u._id, 'PUT', v); setM('Saved'); } catch (e) { setM(e.message); } };
  return <tr><td>{u.name}<br /><small>{u.region}</small></td><td><input value={v.city} onChange={set('city')} placeholder="City" /></td><td><input value={v.intake} onChange={set('intake')} placeholder="Autumn" /></td><td><input type="date" value={v.deadline} onChange={set('deadline')} /></td>
    <td><input value={v.lastVerified} onChange={set('lastVerified')} placeholder="YYYY-MM-DD" /></td><td><input value={v.website} onChange={set('website')} placeholder="University site" /></td><td><input value={v.admissionsUrl} onChange={set('admissionsUrl')} placeholder="Admissions URL" /></td><td><input value={v.dsuApplyUrl} onChange={set('dsuApplyUrl')} placeholder="DSU URL" /></td><td><input value={v.accessibilityNote} onChange={set('accessibilityNote')} placeholder="Accessibility note" /></td><td><button onClick={save}>Save</button> <small>{m}</small></td></tr>;
}

const emptyScholarship = () => ({
  title: '', provider: '', region: '', universities: [], description: '', benefits: '',
  applicationStart: '', deadline: '', intake: '', eligibility: '', requirements: '',
  procedure: '', officialUrl: '', status: 'upcoming', lastVerified: ''
});

const emptyAnnouncement = () => ({
  title: '', message: '', category: 'important', startsAt: '', endsAt: '',
  officialUrl: '', published: true
});

export default function Admin() {
  const [user, setUser] = useState(null), [checking, setChecking] = useState(true), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [tab, setTab] = useState('overview');
  const [progs, setProgs] = useState([]), [q, setQ] = useState(''), [unis, setUnis] = useState([]), [leads, setLeads] = useState([]), [f, setF] = useState({ course: '', dept: '', university: '', link: '', level: 'master' }), [imp, setImp] = useState(''), [rep, setRep] = useState(false), [file, setFile] = useState(null), [preview, setPreview] = useState([]), [validationErrors, setValidationErrors] = useState([]), [importEntity, setImportEntity] = useState('programs');
  const [scholarships, setScholarships] = useState([]);
  const [scholarshipForm, setScholarshipForm] = useState(emptyScholarship);
  const [scholarshipNotice, setScholarshipNotice] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement);
  const [announcementNotice, setAnnouncementNotice] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChange, setPasswordChange] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({ programs: 0, universities: 0, scholarships: 0, announcements: 0, leads: 0 });
  const call = useCallback(async (url, method = 'GET', body) => {
    const send = () => authRequest('/api/admin' + url, {
      method,
      headers: method === 'GET' ? {} : { 'x-csrf-token': readCookie('csrfToken') },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    try {
      return await send();
    } catch (error) {
      if (error.status !== 401) throw error;
      await authRequest('/api/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': readCookie('csrfToken') } });
      return send();
    }
  }, []);
  const run = fn => fn().catch(e => setErr(e.message));
  const loadProgs = useCallback(async () => setProgs((await call('/programs?q=' + encodeURIComponent(q))).slice(0, 40)), [q, call]);
  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        let data;
        try {
          data = await authRequest('/api/auth/me');
        } catch (error) {
          if (error.status !== 401) throw error;
          await authRequest('/api/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': readCookie('csrfToken') } });
          data = await authRequest('/api/auth/me');
        }
        if (!['admin', 'editor'].includes(data.user?.role)) throw new Error('Sign in with an admin or editor account.');
        if (active && (location.pathname === '/admin' || location.pathname === '/admin/')) {
          window.location.replace('/admin/dashboard');
          return;
        }
        if (active) setUser(data.user);
      } catch (error) {
        if (active && error.status !== 401) setErr(error.message);
      } finally {
        if (active) setChecking(false);
      }
    };
    restoreSession();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!user) return;
    run(async () => {
      setErr('');
      if (tab === 'overview') {
        const [programRows, universityRows, scholarshipRows, announcementRows, leadRows] = await Promise.all([
          call('/programs'),
          call('/universities'),
          call('/scholarships'),
          call('/announcements'),
          call('/leads')
        ]);
        setDashboardStats({
          programs: programRows.length,
          universities: universityRows.length,
          scholarships: scholarshipRows.length,
          announcements: announcementRows.length,
          leads: leadRows.length
        });
      }
      if (tab === 'programs') await loadProgs();
      if (tab === 'universities') setUnis(await call('/universities'));
      if (tab === 'leads') setLeads(await call('/leads'));
      if (tab === 'scholarships') {
        const [scholarshipRows, universities] = await Promise.all([call('/scholarships'), call('/universities')]);
        setScholarships(scholarshipRows);
        setUnis(universities);
      }
      if (tab === 'announcements') setAnnouncements(await call('/announcements'));
    });
  }, [user, tab, loadProgs, call]);
  const login = async e => {
    e.preventDefault();
    setErr('');
    try {
      const data = await authRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password: pw }) });
      if (!['admin', 'editor'].includes(data.user?.role)) {
        await authRequest('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': readCookie('csrfToken') } });
        throw new Error('This portal is for admin and editor accounts.');
      }
      window.location.assign('/admin/dashboard');
    } catch (error) {
      setErr(error.message);
    }
  };
  const logout = async () => {
    try {
      await authRequest('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': readCookie('csrfToken') } });
      setUser(null);
    } catch (error) {
      setErr(error.message);
    }
  };
  if (checking) return <main className="admin-login-page"><p role="status">Checking secure admin session…</p></main>;
  if (!user) return <main className="admin-login-page">
    <a className="admin-login-brand" href="/">Study in Italy <span>ADMIN</span></a>
    <form className="admin-login-card" onSubmit={login}>
      <div className="admin-login-mark" aria-hidden="true">SI</div>
      <p className="admin-eyebrow">Secure workspace</p>
      <h1>Admin sign in</h1>
      <p className="admin-login-copy">Manage programs, universities, scholarships, announcements, and student requests.</p>
      <label htmlFor="admin-email">Work email</label>
      <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
      <label htmlFor="admin-password">Password</label>
      <input id="admin-password" type="password" autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} placeholder="Enter your password" />
      <button className="admin-login-submit" type="submit">Sign in to dashboard</button>
      <p className="err" role="alert">{err}</p>
      <a href="/admin/forgot-password">Forgot admin password?</a>
      <div className="admin-login-divider"><span>Admin accounts only</span></div>
      <a className="admin-student-link" href="/student">Looking for the student portal?</a>
    </form>
    <p className="admin-login-footnote">Access is limited to accounts provisioned by your system administrator.</p>
  </main>;
  const save = () => run(async () => { await call('/programs' + (f._id ? '/' + f._id : ''), f._id ? 'PUT' : 'POST', f); setF({ course: '', dept: '', university: '', link: '', level: 'master' }); await loadProgs(); });
  const del = id => confirm('Delete this program?') && run(async () => { await call('/programs/' + id, 'DELETE'); await loadProgs(); });
  const doImport = () => run(async () => { const r = await call('/import', 'POST', { rows: JSON.parse(imp), replace: rep }); alert('Imported ' + r.imported); await loadProgs(); });
  const previewCsv = async () => {
    if (!file) return setErr('Choose a CSV file first.');
    const csv = await file.text(), result = await call('/import/preview', 'POST', { csv, entity: importEntity });
    setPreview(result.rows); setValidationErrors(result.errors);
  };
  const saveCsv = async () => {
    if (!file) return setErr('Choose a CSV file first.');
    const csv = await file.text(), result = await call('/import', 'POST', { csv, entity: importEntity, replace: rep });
    setErr('Imported ' + result.imported + ' rows.'); await loadProgs();
  };
  const selectedRegionUniversities = unis.filter(university => university.region === scholarshipForm.region);
  const updateScholarshipField = (field, value) => setScholarshipForm(current => ({ ...current, [field]: value }));
  const saveScholarship = () => run(async () => {
    setScholarshipNotice('');
    const payload = {
      ...scholarshipForm,
      requirements: typeof scholarshipForm.requirements === 'string' ? scholarshipForm.requirements.split('\n') : scholarshipForm.requirements,
      procedure: typeof scholarshipForm.procedure === 'string' ? scholarshipForm.procedure.split('\n') : scholarshipForm.procedure
    };
    const saved = await call('/scholarships' + (payload._id ? '/' + payload._id : ''), payload._id ? 'PUT' : 'POST', payload);
    setScholarships(current => payload._id
      ? current.map(item => item._id === saved._id ? saved : item)
      : [saved, ...current]);
    setScholarshipForm(emptyScholarship());
    setScholarshipNotice(payload._id ? 'Scholarship updated.' : 'Scholarship added.');
  });
  const editScholarship = item => {
    setScholarshipNotice('');
    setScholarshipForm({
      ...item,
      universities: (item.universities || []).map(university => ({ name: university.name, description: university.description || '' })),
      requirements: (item.requirements || []).join('\n'),
      procedure: (item.procedure || []).join('\n')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const deleteScholarship = item => confirm(`Delete "${item.title}"?`) && run(async () => {
    await call('/scholarships/' + item._id, 'DELETE');
    setScholarships(current => current.filter(scholarship => scholarship._id !== item._id));
    if (scholarshipForm._id === item._id) setScholarshipForm(emptyScholarship());
    setScholarshipNotice('Scholarship deleted.');
  });
  const toggleScholarshipUniversity = (name, selected) => setScholarshipForm(current => ({
    ...current,
    universities: selected
      ? [...current.universities.filter(university => university.name !== name), { name, description: '' }]
      : current.universities.filter(university => university.name !== name)
  }));
  const updateAnnouncementField = (field, value) => setAnnouncementForm(current => ({ ...current, [field]: value }));
  const saveAnnouncement = () => run(async () => {
    setAnnouncementNotice('');
    const payload = { ...announcementForm };
    const saved = await call('/announcements' + (payload._id ? '/' + payload._id : ''), payload._id ? 'PUT' : 'POST', payload);
    setAnnouncements(current => payload._id
      ? current.map(item => item._id === saved._id ? saved : item)
      : [saved, ...current]);
    setAnnouncementForm(emptyAnnouncement());
    setAnnouncementNotice(payload._id ? 'Announcement updated.' : 'Announcement published.');
  });
  const editAnnouncement = item => {
    setAnnouncementNotice('');
    setAnnouncementForm({ ...item });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const deleteAnnouncement = item => confirm(`Delete "${item.title}"?`) && run(async () => {
    await call('/announcements/' + item._id, 'DELETE');
    setAnnouncements(current => current.filter(announcement => announcement._id !== item._id));
    if (announcementForm._id === item._id) setAnnouncementForm(emptyAnnouncement());
    setAnnouncementNotice('Announcement deleted.');
  });
  const changePassword = async event => {
    event.preventDefault();
    const passwordError = validateNewPassword(passwordChange.newPassword, user.email);
    if (passwordError) {
      setPasswordMessage({ text: passwordError, type: 'error' });
      return;
    }
    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      setPasswordMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    setChangingPassword(true);
    setPasswordMessage({ text: '', type: '' });
    try {
      await authRequest('/api/auth/change-password', {
        method: 'POST',
        headers: { 'x-csrf-token': readCookie('csrfToken') },
        body: JSON.stringify({ currentPassword: passwordChange.currentPassword, newPassword: passwordChange.newPassword })
      });
      window.location.replace('/admin');
    } catch (error) {
      setPasswordMessage({ text: error.message, type: 'error' });
      setChangingPassword(false);
    }
  };
  const tabs = [
    ['overview', 'Overview', 'OV'],
    ['programs', 'Programs', 'PR'],
    ['universities', 'Universities', 'UN'],
    ['scholarships', 'Scholarships', 'SC'],
    ['announcements', 'Announcements', 'AN'],
    ['leads', 'Student requests', 'SR']
  ];
  const activeTitle = tabs.find(([id]) => id === tab)?.[1] || 'Overview';
  return <div className="admin-app">
    <header className="admin-topbar">
      <a className="admin-brand" href="/admin/dashboard"><span className="admin-brand-mark">SI</span><span>Study in Italy<small>ADMIN CONSOLE</small></span></a>
      <div className="admin-topbar-actions">
        <a href="/" className="admin-view-site">View public site <span aria-hidden="true">↗</span></a>
        <span className="admin-user-chip"><span className="admin-avatar">{user.name?.slice(0, 1).toUpperCase() || 'A'}</span><span><b>{user.name}</b><small>{user.role}</small></span></span>
        <button className="admin-topbar-button" onClick={() => { setShowPasswordChange(value => !value); setPasswordMessage({ text: '', type: '' }); }}>Account</button>
        <button className="admin-logout" onClick={logout}>Log out</button>
      </div>
    </header>
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <p className="admin-nav-label">WORKSPACE</p>
        <nav>{tabs.map(([id, label, icon]) => <button key={id} className={`admin-nav-item ${tab === id ? 'active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><span className="admin-nav-icon">{icon}</span><span>{label}</span>{id === 'leads' && dashboardStats.leads > 0 && <span className="admin-nav-count">{dashboardStats.leads}</span>}</button>)}</nav>
        <div className="admin-sidebar-bottom"><span className="admin-status-dot" /> Secure admin workspace <a href="/admin/forgot-password">Password help</a></div>
      </aside>
      <main className="admin-main">
        <div className="admin-page-heading">
          <div><p className="admin-eyebrow">{tab === 'overview' ? 'WORKSPACE OVERVIEW' : 'CONTENT MANAGEMENT'}</p><h1>{tab === 'overview' ? `Good day, ${user.name.split(' ')[0]}` : activeTitle}</h1><p>{tab === 'overview' ? 'Manage your study-abroad content and keep student information up to date.' : `Manage ${activeTitle.toLowerCase()} for the student platform.`}</p></div>
          <span className="admin-heading-date">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        {showPasswordChange && <form className="admin-password-form" onSubmit={changePassword}>
          <h3>Change admin password</h3>
          <PasswordField id="admin-current-password" name="currentPassword" label="Current password" value={passwordChange.currentPassword} onChange={event => setPasswordChange(current => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" required />
          <PasswordField id="admin-new-password" name="newPassword" label="New password" value={passwordChange.newPassword} onChange={event => setPasswordChange(current => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" minLength={10} required />
          <small className="auth-field-help">At least 10 characters, including an uppercase letter and a number.</small>
          <PasswordField id="admin-confirm-password" name="confirmPassword" label="Confirm new password" value={passwordChange.confirmPassword} onChange={event => setPasswordChange(current => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" minLength={10} required />
          <button type="submit" disabled={changingPassword}>{changingPassword ? 'Changing password…' : 'Update password'}</button>
          <p className={`student-auth-message ${passwordMessage.type}`} role={passwordMessage.type === 'error' ? 'alert' : 'status'}>{passwordMessage.text}</p>
        </form>}
        <p className="err admin-global-error" role="alert">{err}</p>
        {tab === 'overview' && <section className="admin-overview">
          <div className="admin-overview-intro"><div><h2>Platform at a glance</h2><p>Here’s what is currently managed in your portal.</p></div><span className="admin-live-status"><i /> Workspace active</span></div>
          <div className="admin-stat-grid">
            {[['Programs', dashboardStats.programs, 'programs', 'PR'], ['Universities', dashboardStats.universities, 'universities', 'UN'], ['Scholarship calls', dashboardStats.scholarships, 'scholarships', 'SC'], ['Announcements', dashboardStats.announcements, 'announcements', 'AN'], ['Student requests', dashboardStats.leads, 'leads', 'SR']].map(([label, count, destination, icon]) => <button key={destination} className="admin-stat-card" onClick={() => setTab(destination)}><span className="admin-stat-icon">{icon}</span><span className="admin-stat-label">{label}</span><b>{count}</b><span className="admin-stat-action">Manage {label.toLowerCase()} <span aria-hidden="true">→</span></span></button>)}
          </div>
          <div className="admin-quick-grid">
            <section className="admin-quick-card"><div><p className="admin-eyebrow">CONTENT</p><h3>Keep scholarship calls current</h3><p>Add verified deadlines, eligibility, requirements, and official links so students can apply with confidence.</p></div><button onClick={() => setTab('scholarships')}>Manage scholarships <span aria-hidden="true">→</span></button></section>
            <section className="admin-quick-card"><div><p className="admin-eyebrow">STUDENT SUPPORT</p><h3>Share an important update</h3><p>Publish upcoming calls, application reminders, important notices, or news to student dashboards.</p></div><button onClick={() => setTab('announcements')}>Create announcement <span aria-hidden="true">→</span></button></section>
          </div>
        </section>}
        <section className="admin-workspace">
    {tab === 'programs' && <><h3>{f._id ? 'Edit program' : 'Add program'}</h3>
      {['course', 'dept', 'university', 'link'].map(k => <input key={k} placeholder={k} value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} />)}
      <select value={f.level} onChange={e => setF({ ...f, level: e.target.value })}><option value="master">master</option><option value="bachelor">bachelor</option></select><button onClick={save}>Save</button>
      <h3>CSV import</h3><label>Entity<select value={importEntity} onChange={e => setImportEntity(e.target.value)}><option value="programs">Programs</option><option value="universities">Universities</option></select></label><input type="file" accept=".csv,text/csv" onChange={e => setFile(e.target.files[0])} /><button onClick={previewCsv}>Preview rows</button>
      <p className="tag">Templates: programs-import-template.csv and universities-import-template.csv in server/data.</p>
      {validationErrors.length > 0 && <p className="err">{validationErrors.join(' • ')}</p>}
      {preview.length > 0 && <div className="tbl"><table><thead><tr>{Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}</tr></thead><tbody>{preview.slice(0, 5).map((r, i) => <tr key={i}>{Object.keys(preview[0]).map(k => <td key={k}>{String(r[k] || '')}</td>)}</tr>)}</tbody></table></div>}
      <label><input type="checkbox" checked={rep} onChange={e => setRep(e.target.checked)} /> replace all rows</label><button onClick={saveCsv} disabled={!preview.length || validationErrors.length}>Save validated CSV</button>
      <h3>Programs</h3><input placeholder="search" value={q} onChange={e => setQ(e.target.value)} />
      <table><tbody>{progs.map(p => <tr key={p._id}><td>{p.course}<br /><small>{p.university} · {p.level}</small></td><td><button onClick={() => setF(p)}>Edit</button><button onClick={() => del(p._id)}>Delete</button></td></tr>)}</tbody></table></>}
    {tab === 'universities' && <><p>Set each university's intake and deadline (YYYY-MM-DD) from its official page. Status updates automatically on the site.</p>
      <table><thead><tr><th>University</th><th>Region</th><th>City</th><th>Intake</th><th>Deadline</th><th>Last verified</th><th>Source</th><th /></tr></thead><tbody>{unis.map(u => <UniRow key={u._id} u={u} call={call} />)}</tbody></table></>}
    {tab === 'scholarships' && <section className="admin-scholarship-manager">
      <h3>{scholarshipForm._id ? 'Update scholarship' : 'Add scholarship'}</h3>
      <p>Add verified scholarship calls and maintain their application details. Active and upcoming calls appear in the student portal; closed calls remain available here for editing or deletion.</p>
      <div className="admin-scholarship-form">
        <label>Scholarship title<input required maxLength={160} value={scholarshipForm.title} onChange={event => updateScholarshipField('title', event.target.value)} placeholder="e.g. Regional right-to-study grant" /></label>
        <label>Provider / funding body<input required maxLength={160} value={scholarshipForm.provider} onChange={event => updateScholarshipField('provider', event.target.value)} placeholder="e.g. EDISU Piemonte" /></label>
        <label>Region<select required value={scholarshipForm.region} onChange={event => setScholarshipForm(current => ({ ...current, region: event.target.value, universities: [] }))}><option value="">Select region</option>{[...new Set(unis.map(university => university.region).filter(Boolean))].sort().map(region => <option key={region}>{region}</option>)}</select></label>
        {scholarshipForm.region && <fieldset className="admin-scholarship-unis"><legend>Universities covered</legend>
          {selectedRegionUniversities.length ? selectedRegionUniversities.map(university => <label key={university._id}>
            <input type="checkbox" checked={scholarshipForm.universities.some(item => item.name === university.name)} onChange={event => toggleScholarshipUniversity(university.name, event.target.checked)} />
            {university.name}
          </label>) : <p>No universities have been added for this region yet.</p>}
        </fieldset>}
        {scholarshipForm.universities.map(university => <label key={university.name}>{university.name} — scholarship information<textarea rows={3} maxLength={2000} value={university.description} onChange={event => updateScholarshipField('universities', scholarshipForm.universities.map(item => item.name === university.name ? { ...item, description: event.target.value } : item))} placeholder="Describe this scholarship at this university" /></label>)}
        <label>Scholarship description<textarea required rows={4} maxLength={5000} value={scholarshipForm.description} onChange={event => updateScholarshipField('description', event.target.value)} placeholder="Explain what the award is and who provides it" /></label>
        <label>Benefits / award details<textarea rows={3} maxLength={2000} value={scholarshipForm.benefits} onChange={event => updateScholarshipField('benefits', event.target.value)} placeholder="Tuition waiver, stipend, meals, housing, amount if confirmed" /></label>
        <label>Intake<input maxLength={120} value={scholarshipForm.intake} onChange={event => updateScholarshipField('intake', event.target.value)} placeholder="e.g. 2027/28" /></label>
        <label>Application opens<input type="date" value={scholarshipForm.applicationStart || ''} onChange={event => updateScholarshipField('applicationStart', event.target.value)} /></label>
        <label>Application deadline<input type="date" value={scholarshipForm.deadline || ''} onChange={event => updateScholarshipField('deadline', event.target.value)} /></label>
        <label>Eligibility<textarea rows={3} maxLength={3000} value={scholarshipForm.eligibility} onChange={event => updateScholarshipField('eligibility', event.target.value)} placeholder="Academic, residency, income, nationality, or other conditions" /></label>
        <label>Requirements (one per line)<textarea rows={4} value={scholarshipForm.requirements} onChange={event => updateScholarshipField('requirements', event.target.value)} placeholder="Passport&#10;Academic transcripts&#10;Family income documents" /></label>
        <label>Application procedure (one step per line)<textarea rows={5} value={scholarshipForm.procedure} onChange={event => updateScholarshipField('procedure', event.target.value)} placeholder="Create an account on the official portal&#10;Complete the application form&#10;Upload required documents" /></label>
        <label>Official scholarship link<input type="url" maxLength={2048} value={scholarshipForm.officialUrl} onChange={event => updateScholarshipField('officialUrl', event.target.value)} placeholder="https://..." /></label>
        <label>Last verified<input type="date" value={scholarshipForm.lastVerified || ''} onChange={event => updateScholarshipField('lastVerified', event.target.value)} /></label>
        <label>Publication status<select value={scholarshipForm.status} onChange={event => updateScholarshipField('status', event.target.value)}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="closed">Closed</option></select></label>
      </div>
      <div className="admin-scholarship-actions"><button onClick={saveScholarship}>{scholarshipForm._id ? 'Save changes' : 'Add scholarship'}</button>{scholarshipForm._id && <button className="admin-scholarship-cancel" onClick={() => { setScholarshipForm(emptyScholarship()); setScholarshipNotice(''); }}>Cancel edit</button>}<span role="status">{scholarshipNotice}</span></div>
      <h3>Scholarship records ({scholarships.length})</h3>
      {!scholarships.length ? <p>No scholarships have been added yet.</p> : <div className="tbl"><table><thead><tr><th>Title</th><th>Provider</th><th>Region</th><th>Universities</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead><tbody>{scholarships.map(item => <tr key={item._id}><td>{item.title}</td><td>{item.provider}</td><td>{item.region}</td><td>{item.universities.map(university => university.name).join(', ')}</td><td>{item.deadline || 'Not announced'}</td><td>{item.status}</td><td><button onClick={() => editScholarship(item)}>Edit</button><button onClick={() => deleteScholarship(item)}>Delete</button></td></tr>)}</tbody></table></div>}
    </section>}
    {tab === 'announcements' && <section className="admin-scholarship-manager">
      <h3>{announcementForm._id ? 'Edit announcement' : 'Create student announcement'}</h3>
      <p>Publish scholarship alerts, upcoming calls, important announcements, or news for student dashboards. Optional dates control when a published notice is visible.</p>
      <div className="admin-scholarship-form">
        <label>Title<input required maxLength={180} value={announcementForm.title} onChange={event => updateAnnouncementField('title', event.target.value)} placeholder="Announcement title" /></label>
        <label>Category<select value={announcementForm.category} onChange={event => updateAnnouncementField('category', event.target.value)}><option value="scholarship">Current scholarship</option><option value="upcoming">Upcoming scholarship</option><option value="important">Important announcement</option><option value="news">News</option></select></label>
        <label className="announcement-message-field">Message<textarea required rows={5} maxLength={5000} value={announcementForm.message} onChange={event => updateAnnouncementField('message', event.target.value)} placeholder="Share key details, what students should do, and any relevant guidance." /></label>
        <label>Show from<input type="date" value={announcementForm.startsAt || ''} onChange={event => updateAnnouncementField('startsAt', event.target.value)} /></label>
        <label>Show until<input type="date" value={announcementForm.endsAt || ''} onChange={event => updateAnnouncementField('endsAt', event.target.value)} /></label>
        <label>Official link (optional)<input type="url" maxLength={2048} value={announcementForm.officialUrl || ''} onChange={event => updateAnnouncementField('officialUrl', event.target.value)} placeholder="https://..." /></label>
        <label className="admin-announcement-published"><input type="checkbox" checked={announcementForm.published} onChange={event => updateAnnouncementField('published', event.target.checked)} /> Publish to students</label>
      </div>
      <div className="admin-scholarship-actions"><button onClick={saveAnnouncement}>{announcementForm._id ? 'Save announcement' : 'Publish announcement'}</button>{announcementForm._id && <button className="admin-scholarship-cancel" onClick={() => { setAnnouncementForm(emptyAnnouncement()); setAnnouncementNotice(''); }}>Cancel edit</button>}<span role="status">{announcementNotice}</span></div>
      <h3>Announcements ({announcements.length})</h3>
      {!announcements.length ? <p>No announcements have been created yet.</p> : <div className="tbl"><table><thead><tr><th>Title</th><th>Category</th><th>Visible dates</th><th>Published</th><th>Actions</th></tr></thead><tbody>{announcements.map(item => <tr key={item._id}><td>{item.title}</td><td>{item.category}</td><td>{item.startsAt || 'Immediately'} – {item.endsAt || 'No end date'}</td><td>{item.published ? 'Yes' : 'Draft'}</td><td><button onClick={() => editAnnouncement(item)}>Edit</button><button onClick={() => deleteAnnouncement(item)}>Delete</button></td></tr>)}</tbody></table></div>}
    </section>}
    {tab === 'leads' && <><p>Student questions and requests for application guidance are received here. Reply directly to the email address shown.</p><table><thead><tr><th>Name</th><th>Email</th><th>WhatsApp</th><th>Message</th></tr></thead><tbody>{leads.map(l => <tr key={l._id}><td>{l.name}</td><td>{l.email}</td><td>{l.whatsapp}</td><td style={{ whiteSpace: 'pre-wrap' }}>{l.message}</td></tr>)}</tbody></table></>}
        </section>
        <footer className="admin-contact-footer"><b>Student support contact</b><span>Email: not added yet</span><span>Phone / WhatsApp: not added yet</span><span>Student guidance requests can be reviewed in the Student requests tab.</span></footer>
      </main>
    </div>
  </div>;
}
