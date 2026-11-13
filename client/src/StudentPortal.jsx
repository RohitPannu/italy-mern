import { useEffect, useState } from 'react';
import { authRequest, readCookie } from './authApi.js';
import { APPLICATION_STEPS, SCHOLARSHIP_ROUTES } from './studentGuide.js';

const formatDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || 'Not announced';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' });
};

export default function StudentPortal() {
  const [student, setStudent] = useState(null);
  const [message, setMessage] = useState('');
  const [directoryMessage, setDirectoryMessage] = useState('');
  const [directory, setDirectory] = useState(null);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [reload, setReload] = useState(0);
  const [contactForm, setContactForm] = useState({ whatsapp: '', message: '' });
  const [sendingMessage, setSendingMessage] = useState(false);
  const [contactNotice, setContactNotice] = useState({ text: '', type: '' });

  useEffect(() => {
    let active = true;
    const loadStudent = async () => {
      setMessage('');
      setDirectoryMessage('');
      setDirectory(null);
      setLoadingDirectory(true);
      try {
        let account;
        try {
          account = await authRequest('/api/auth/me');
        } catch (error) {
          if (error.status !== 401) throw error;
          await authRequest('/api/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': readCookie('csrfToken') } });
          account = await authRequest('/api/auth/me');
        }
        if (account.user?.role !== 'student') throw new Error('This portal is for student accounts.');
        if (active) setStudent(account.user);

        try {
          const [programs, meta, scholarships, announcements] = await Promise.all([
            authRequest('/api/programs'),
            authRequest('/api/meta'),
            authRequest('/api/scholarships'),
            authRequest('/api/me/announcements')
          ]);
          if (!Array.isArray(programs) || !Array.isArray(meta.unis) || !Array.isArray(meta.regions) || !Array.isArray(scholarships) || !Array.isArray(announcements)) {
            throw new Error('The scholarship and admissions data is incomplete. Please try again later.');
          }
          if (active) setDirectory({ programs, meta, scholarships, announcements });
        } catch (error) {
          if (active) setDirectoryMessage(error.message);
        }
      } catch (error) {
        if (active && [401, 403].includes(error.status)) window.location.replace('/student?expired=1');
        else if (active) setMessage(error.message);
      } finally {
        if (active) setLoadingDirectory(false);
      }
    };
    loadStudent();
    return () => { active = false; };
  }, [reload]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authRequest('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': readCookie('csrfToken') } });
    } catch {
      setMessage('Could not sign out. Check your connection and try again.');
      setLoggingOut(false);
      return;
    }
    window.location.replace('/student');
  };

  const sendGuidanceRequest = async event => {
    event.preventDefault();
    if (sendingMessage) return;
    setSendingMessage(true);
    setContactNotice({ text: '', type: '' });
    try {
      await authRequest('/api/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: student.name,
          email: student.email,
          whatsapp: contactForm.whatsapp.trim(),
          message: contactForm.message.trim()
        })
      });
      setContactForm(current => ({ ...current, message: '' }));
      setContactNotice({ text: 'Your question has been sent. The admin team will follow up using your email address.', type: 'success' });
    } catch (error) {
      setContactNotice({ text: error.message, type: 'error' });
    } finally {
      setSendingMessage(false);
    }
  };

  if (message) return <main className="adm student-auth-page"><section className="card student-auth-card"><h1>Student account</h1><p className="student-auth-message error" role="alert">{message}</p><a href="/student">Return to sign in</a></section></main>;
  if (!student) return <main className="adm student-auth-page"><p role="status">Loading student account…</p></main>;

  const universities = directory?.meta.unis || [];
  const regions = directory?.meta.regions || [];
  const programCounts = (directory?.programs || []).reduce((counts, program) => {
    counts[program.university] = (counts[program.university] || 0) + 1;
    return counts;
  }, {});
  const today = new Date().toISOString().slice(0, 10);
  const deadlineRecords = universities
    .filter(university => university.intake || university.deadline || university.lastCycle)
    .sort((a, b) => {
      const aFuture = a.deadline && a.deadline >= today;
      const bFuture = b.deadline && b.deadline >= today;
      if (aFuture && bFuture) return a.deadline.localeCompare(b.deadline);
      if (aFuture) return -1;
      if (bFuture) return 1;
      if (a.deadline && !b.deadline) return -1;
      if (b.deadline && !a.deadline) return 1;
      return a.name.localeCompare(b.name);
    });

  return <main className="student-dashboard-page">
    <nav className="student-dashboard-nav">
      <a className="logo" href="/">Study in Italy</a>
      <span className="student-dashboard-account">{student.email}</span>
      <button className="student-auth-submit" disabled={loggingOut} onClick={logout}>{loggingOut ? 'Signing out…' : 'Log out'}</button>
    </nav>
    <header className="student-dashboard-hero">
      <div className="student-dashboard-wrap">
        <p className="student-auth-kicker">Student portal · Study in Italy</p>
        <h1>Welcome, {student.name}</h1>
        <p>Explore scholarship routes, review university intakes and deadlines, and follow the application steps.</p>
      </div>
    </header>

    <div className="student-dashboard-wrap student-dashboard-content">
      {loadingDirectory && <p role="status">Loading scholarships and university deadlines…</p>}
      {directoryMessage && <div className="student-dashboard-alert" role="alert">
        <p>{directoryMessage}</p>
        <button className="student-auth-submit" onClick={() => setReload(value => value + 1)}>Try again</button>
      </div>}

      {directory?.announcements.length > 0 && <section className="student-dashboard-section student-announcements" aria-labelledby="student-announcements-title">
        <h2 id="student-announcements-title">Announcements and student alerts</h2>
        <p className="lead">Updates from the admin team about scholarship calls, important dates, and study-in-Italy news.</p>
        <div className="grid">{directory.announcements.map(announcement => <article className={`card student-announcement-card student-announcement-${announcement.category}`} key={announcement._id}>
          <span className="tag">{announcement.category === 'scholarship' ? 'Current scholarship' : announcement.category === 'upcoming' ? 'Upcoming scholarship' : announcement.category === 'news' ? 'News' : 'Important announcement'}</span>
          <h3>{announcement.title}</h3>
          <p>{announcement.message}</p>
          {(announcement.startsAt || announcement.endsAt) && <small className="tag">Notice period: {announcement.startsAt ? formatDate(announcement.startsAt) : 'Now'} – {announcement.endsAt ? formatDate(announcement.endsAt) : 'No end date'}</small>}
          {announcement.officialUrl && <a href={announcement.officialUrl} target="_blank" rel="noopener noreferrer">Open official link</a>}
        </article>)}</div>
      </section>}

      <section className="student-dashboard-section" aria-labelledby="student-scholarships-title">
        <h2 id="student-scholarships-title">Current scholarship calls</h2>
        <p className="lead">Scholarships marked active or upcoming by the admin team. Confirm the current call and dates at the official link before applying.</p>
        {!loadingDirectory && !directoryMessage && !directory?.scholarships.length && <p>No active or upcoming scholarship calls are listed right now. Check back later or contact the admin team for guidance.</p>}
        <div className="grid">
          {(directory?.scholarships || []).map(scholarship => <article className="card student-scholarship-card" key={scholarship._id}>
            <span className="tag">{scholarship.status === 'active' ? 'Active scholarship' : 'Upcoming scholarship'} · {scholarship.provider}</span>
            <h3>{scholarship.title}</h3>
            <p className="student-scholarship-region">{scholarship.region}{scholarship.intake ? ` · ${scholarship.intake}` : ''}</p>
            <p>{scholarship.description}</p>
            {scholarship.benefits && <div><b>Benefits:</b> {scholarship.benefits}</div>}
            {scholarship.eligibility && <div><b>Eligibility:</b> {scholarship.eligibility}</div>}
            {scholarship.universities?.length > 0 && <div><b>Universities</b><ul>{scholarship.universities.map(university => <li key={university.name}><b>{university.name}</b>{university.description && <p>{university.description}</p>}</li>)}</ul></div>}
            {(scholarship.applicationStart || scholarship.deadline) && <p><b>Application period:</b> {scholarship.applicationStart ? formatDate(scholarship.applicationStart) : 'Not announced'} – {scholarship.deadline ? formatDate(scholarship.deadline) : 'Not announced'}</p>}
            {scholarship.requirements?.length > 0 && <div><b>Requirements</b><ul>{scholarship.requirements.map((requirement, index) => <li key={index}>{requirement}</li>)}</ul></div>}
            {scholarship.procedure?.length > 0 && <div><b>How to apply</b><ol>{scholarship.procedure.map((step, index) => <li key={index}>{step}</li>)}</ol></div>}
            <div className="student-scholarship-footer">
              <span className="tag">Deadline: {scholarship.deadline ? formatDate(scholarship.deadline) : 'Not announced'}</span>
              {scholarship.officialUrl && <a href={scholarship.officialUrl} target="_blank" rel="noopener noreferrer">Official scholarship page</a>}
              {scholarship.lastVerified && <small className="tag">Last verified: {formatDate(scholarship.lastVerified)}</small>}
            </div>
          </article>)}
        </div>
        <h3 className="student-scholarship-subtitle">Common scholarship routes</h3>
        <p className="lead">General information about the main funding routes. No scholarship is guaranteed; check current calls and eligibility with the official provider.</p>
        <div className="grid">
          {SCHOLARSHIP_ROUTES.map(([label, title, description]) => <article className="card" key={title}>
            <span className="tag">{label}</span>
            <h3>{title}</h3>
            <p>{description}</p>
            {title.includes('MAECI') && <a href="https://studyinitaly.esteri.it/" target="_blank" rel="noopener noreferrer">Visit the official Study in Italy portal</a>}
            {title === 'University awards' && <a href="#student-deadlines">Find university application links below</a>}
          </article>)}
        </div>
      </section>

      <section className="student-dashboard-section" aria-labelledby="student-regional-title">
        <h2 id="student-regional-title">Regional DSU grants</h2>
        <p className="lead">DSU and right-to-study grants are handled regionally. The timing shown is a reference from the available records, not confirmation that a call is open now. Scholarship deadlines are separate from university admission deadlines.</p>
        {!loadingDirectory && !directoryMessage && regions.length === 0 && <p>No regional scholarship information has been published yet.</p>}
        <div className="grid">
          {regions.map(region => {
            const regionalUniversities = universities.filter(university => university.region === region.name);
            const applicationUrl = region.url || regionalUniversities.find(university => university.dsuApplyUrl)?.dsuApplyUrl;
            return <article className="card" key={region.name}>
              <span className="tag">{region.dsu || 'Regional right-to-study office'}</span>
              <h3>{region.name}</h3>
              <p>{region.dsu ? `Funding body: ${region.dsu}.` : 'Contact the university right-to-study office for the regional grant.'} Apply separately after checking eligibility and the current call.</p>
              {region.timing && <small className="tag">Timing on record: {region.timing}</small>}
              <div className="row">
                {applicationUrl ? <a href={applicationUrl} target="_blank" rel="noopener noreferrer">Official grant information</a> : <span className="tag">Official link not added</span>}
                <span className="tag">{regionalUniversities.length} {regionalUniversities.length === 1 ? 'university' : 'universities'}</span>
              </div>
            </article>;
          })}
        </div>
      </section>

      <section className="student-dashboard-section" id="student-deadlines" aria-labelledby="student-deadlines-title">
        <h2 id="student-deadlines-title">University intakes and deadlines</h2>
        <p className="lead">The status below refers to the university admissions deadline on record, not a scholarship deadline. Always confirm dates on the university’s official site.</p>
        {!loadingDirectory && !directoryMessage && !deadlineRecords.length && <p>No intake or deadline details have been published yet.</p>}
        {deadlineRecords.length > 0 && <div className="tbl">
          <table>
            <thead><tr><th>University</th><th>Region</th><th>Programs listed</th><th>Intake</th><th>Admissions deadline</th><th>Status</th><th>Official page</th></tr></thead>
            <tbody>{deadlineRecords.map(university => {
              const status = university.deadline
                ? (university.deadline >= today ? 'Open' : 'Closed')
                : university.lastCycle ? 'Reference only' : 'Not announced';
              const officialUrl = university.admissionsUrl || university.website || university.source;
              return <tr key={university.name}>
                <td>{university.name}</td>
                <td>{university.region || '—'}</td>
                <td>{programCounts[university.name] || 0}</td>
                <td>{university.intake || 'Not announced'}</td>
                <td>{university.deadline ? formatDate(university.deadline) : university.lastCycle || 'Not announced'}</td>
                <td>{status}</td>
                <td>{officialUrl ? <a href={officialUrl} target="_blank" rel="noopener noreferrer">Visit site</a> : 'Not added'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
      </section>

      <section className="student-dashboard-section" aria-labelledby="student-steps-title">
        <h2 id="student-steps-title">How to apply</h2>
        <p className="lead">Follow the usual sequence, and confirm each requirement with your chosen university and the relevant scholarship authority.</p>
        <ol className="steps">{APPLICATION_STEPS.map(([title, description]) => <li key={title}><b>{title}</b>{description}</li>)}</ol>
      </section>

      <section className="student-dashboard-section" aria-labelledby="student-contact-title">
        <h2 id="student-contact-title">Need help applying?</h2>
        <p className="lead">If you are unsure about a step or need more information, send a question to the admin team. Your account name and email will be included so they can reply.</p>
        <form className="student-guidance-form" onSubmit={sendGuidanceRequest}>
          <label htmlFor="guidance-whatsapp">WhatsApp or phone (optional)</label>
          <input id="guidance-whatsapp" type="tel" autoComplete="tel" maxLength={40} value={contactForm.whatsapp} onChange={event => setContactForm(current => ({ ...current, whatsapp: event.target.value }))} placeholder="Include country code, e.g. +92" />
          <label htmlFor="guidance-message">How can we help?</label>
          <textarea id="guidance-message" required minLength={5} maxLength={2000} rows={5} value={contactForm.message} onChange={event => setContactForm(current => ({ ...current, message: event.target.value }))} placeholder="Tell us which scholarship, university, or application step you have a question about." />
          <button className="student-auth-submit" type="submit" disabled={sendingMessage}>{sendingMessage ? 'Sending…' : 'Send question to admin'}</button>
          <p className={`student-auth-message ${contactNotice.type}`} role={contactNotice.type === 'error' ? 'alert' : 'status'} aria-live="polite">{contactNotice.text}</p>
        </form>
      </section>
    </div>
  </main>;
}
