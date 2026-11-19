const TOKEN_KEY = 'qe_admin_token';

export const token = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (value) => {
    try { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
  },
};

async function request(method, path, body, { isForm = false } = {}) {
  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api/admin${path}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Check your connection and that the backend is running.'), { status: 0 });
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const fallback = res.status >= 500 && !data.message
      ? 'Server is not responding. Make sure the backend (start-backend.bat) is running.'
      : `Request failed (${res.status})`;
    const err = Object.assign(new Error(data.message || fallback), { status: res.status, data });
    if (res.status === 401 && path !== '/login') {
      token.set(null);
      window.dispatchEvent(new Event('qe:admin-logout'));
    }
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
  upload: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request('POST', '/upload', fd, { isForm: true });
  },
};
