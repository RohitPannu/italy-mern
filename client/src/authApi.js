export async function authRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch {
    throw new Error('Could not connect. Check your connection and try again.');
  }

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    try { data = await response.json(); } catch { data = null; }
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'The request could not be completed. Try again.');
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error('The server returned an unexpected response. Try again.');
  return data;
}

export function readCookie(name) {
  return document.cookie.split('; ').find(cookie => cookie.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

export async function getCurrentUser() {
  try {
    return await authRequest('/api/auth/me');
  } catch (error) {
    if (error.status !== 401) throw error;
    await authRequest('/api/auth/refresh', {
      method: 'POST',
      headers: { 'x-csrf-token': readCookie('csrfToken') }
    });
    return authRequest('/api/auth/me');
  }
}

export function validateNewPassword(password, email) {
  if (password.length < 10) return 'Use at least 10 characters.';
  if (password.length > 128) return 'Use no more than 128 characters.';
  const emailName = email.trim().split('@')[0].toLowerCase();
  if (emailName.length >= 3 && password.toLowerCase().includes(emailName)) return 'Do not include your email name in the password.';
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) return 'Include at least one uppercase letter and one number.';
  return '';
}