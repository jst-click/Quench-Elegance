import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite only serves the app under the exact base "/admin/". Redirect "/", "/admin" (no trailing slash)
// and their query-string variants there instead of showing Vite's "did you mean /admin/?" page.
function adminBaseRedirect() {
  const redirect = (req, res, next) => {
    const [path, query = ''] = (req.url || '').split('?');
    // browsers ask for /favicon.ico at the site root, outside the /admin/ base — hand them the client logo
    if (path === '/favicon.ico') {
      res.writeHead(302, { Location: '/admin/images/brand/favicon.png' });
      res.end();
      return;
    }
    if (path === '/' || path === '/admin') {
      res.writeHead(302, { Location: `/admin/${query ? `?${query}` : ''}` });
      res.end();
      return;
    }
    next();
  };
  return {
    name: 'admin-base-redirect',
    configureServer: (server) => { server.middlewares.use(redirect); },
    configurePreviewServer: (server) => { server.middlewares.use(redirect); },
  };
}

// The admin panel is served under /admin/ — in dev on port 5174, in production by FastAPI (backend/app/main.py).
export default defineConfig({
  base: '/admin/',
  plugins: [adminBaseRedirect(), react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // 127.0.0.1 (not "localhost") so Node never tries IPv6 ::1, which uvicorn doesn't listen on
      '/api': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
  preview: { port: 5174 },
});
