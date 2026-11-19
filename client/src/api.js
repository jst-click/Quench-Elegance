const TOKEN_KEYS = { customer: 'qe_token' };

export const tokens = {
  get: (kind) => {
    try { return localStorage.getItem(TOKEN_KEYS[kind]); } catch { return null; }
  },
  set: (kind, value) => {
    try { value ? localStorage.setItem(TOKEN_KEYS[kind], value) : localStorage.removeItem(TOKEN_KEYS[kind]); } catch { /* ignore */ }
  },
};

async function request(method, url, body, { auth = 'customer', isForm = false } = {}) {
  const headers = {};
  const token = auth ? tokens.get(auth) : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Please check your connection and try again.'), { status: 0 });
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const fallback = res.status >= 500 && !data.message
      ? 'Server is not responding. Make sure the backend (start-backend.bat) is running.'
      : `Request failed (${res.status})`;
    const err = new Error(data.message || fallback);
    err.status = res.status;
    err.data = data;
    if (res.status === 401 && auth) {
      tokens.set(auth, null);
      window.dispatchEvent(new CustomEvent('qe:logout', { detail: auth }));
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (url, opts) => request('GET', url, null, opts),
  post: (url, body, opts) => request('POST', url, body, opts),
  put: (url, body, opts) => request('PUT', url, body, opts),
  del: (url, opts) => request('DELETE', url, null, opts),
};

export const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const fmtDate = (d, withTime = false) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '';
