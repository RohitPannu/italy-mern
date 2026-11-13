const email = `verification-${Date.now()}@example.com`;
const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
};
(async () => {
  const json = { 'Content-Type': 'application/json' };
  const invalid = await request('http://127.0.0.1:5000/api/student/login', { method: 'POST', headers: json, body: JSON.stringify({ email: 'missing@example.com', password: 'wrong' }) });
  const registered = await request('http://127.0.0.1:5000/api/student/register', { method: 'POST', headers: json, body: JSON.stringify({ name: 'Verification Student', email, password: 'Strong12', confirmPassword: 'Strong12' }) });
  const duplicate = await request('http://127.0.0.1:5000/api/student/register', { method: 'POST', headers: json, body: JSON.stringify({ name: 'Verification Student', email, password: 'Strong12', confirmPassword: 'Strong12' }) });
  const loggedIn = await request('http://127.0.0.1:5000/api/student/login', { method: 'POST', headers: json, body: JSON.stringify({ email, password: 'Strong12' }) });
  const token = loggedIn.body.token;
  const profile = await request('http://127.0.0.1:5000/api/student/me', { headers: { Authorization: `Bearer ${token}` } });
  const studentDenied = await request('http://127.0.0.1:5000/api/admin/leads', { headers: { Authorization: `Bearer ${token}` } });
  const admin = await request('http://127.0.0.1:5000/api/admin/login', { method: 'POST', headers: json, body: JSON.stringify({ password: 'LocalAdminVerification2026!' }) });
  const adminToken = admin.body.token;
  const adminLeads = await request('http://127.0.0.1:5000/api/admin/leads', { headers: { Authorization: `Bearer ${adminToken}` } });
  const programs = await request('http://127.0.0.1:5000/api/programs');
  const result = {
    invalidLogin: { status: invalid.status, error: invalid.body.error },
    registration: { status: registered.status, user: registered.body.user },
    duplicateRegistration: { status: duplicate.status, error: duplicate.body.error },
    studentLogin: { status: loggedIn.status, role: loggedIn.body.user?.role },
    protectedProfile: { status: profile.status, name: profile.body.name, email: profile.body.email },
    studentAdminDenied: { status: studentDenied.status, error: studentDenied.body.error },
    adminLogin: { status: admin.status, role: admin.body.user?.role },
    adminLeads: { status: adminLeads.status, count: Array.isArray(adminLeads.body) ? adminLeads.body.length : adminLeads.body },
    publicPrograms: { status: programs.status, count: Array.isArray(programs.body) ? programs.body.length : 0 },
    frontend: 'http://127.0.0.1:5173/'
  };
  console.log(JSON.stringify(result, null, 2));
  if (invalid.status !== 401 || registered.status !== 201 || duplicate.status !== 409 || loggedIn.status !== 200 || profile.status !== 200 || studentDenied.status !== 403 || admin.status !== 200 || adminLeads.status !== 200 || programs.status !== 200) process.exitCode = 1;
})();
