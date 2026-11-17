import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, Inbox, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingCart, UserPlus, Users, X } from 'lucide-react';
import { adminApi, tokens } from '../api';
import { useToast } from '../context/AppContext';
import Dashboard from './Dashboard';
import Customers from './Customers';
import CustomerDetail from './CustomerDetail';
import Products from './Products';
import ProductForm from './ProductForm';
import Orders from './Orders';
import OrderDetail from './OrderDetail';
import Requests from './Requests';
import Messages from './Messages';
import AdminSettings from './AdminSettings';

const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

function AdminLogin({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const d = await adminApi.post('/login', form);
      tokens.set('admin', d.token);
      onLogin(d.admin);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={submit}>
        <img src="/images/brand/logo-brown.png" alt="Quench Elegance" />
        <h1>Admin Panel</h1>
        <p className="muted">Sign in to manage customers, products and orders.</p>
        <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus /></div>
        <div className="field"><label htmlFor="a-pass">Password</label><input id="a-pass" type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        <Link to="/" className="btn-link center-text">← Back to website</Link>
      </form>
    </div>
  );
}

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/requests', label: 'Registration requests', icon: UserPlus, badge: 'pendingRequests' },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/messages', label: 'Messages', icon: Inbox, badge: 'unreadMessages' },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState({});
  const [nav, setNav] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    document.title = 'Admin — Quench Elegance';
    if (!tokens.get('admin')) { setReady(true); return; }
    adminApi.get('/me').then((d) => setAdmin(d.admin)).catch(() => {}).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    const h = (e) => e.detail === 'admin' && setAdmin(null);
    window.addEventListener('qe:logout', h);
    return () => window.removeEventListener('qe:logout', h);
  }, []);
  const refreshCounts = () => adminApi.get('/dashboard').then((d) => setCounts(d.stats)).catch(() => {});
  useEffect(() => { if (admin) refreshCounts(); }, [admin, pathname]);
  useEffect(() => setNav(false), [pathname]);

  if (!ready) return <div className="page-loader"><div className="spinner" /></div>;
  if (!admin) return <AdminLogin onLogin={setAdmin} />;

  const logout = () => { tokens.set('admin', null); setAdmin(null); toast('Signed out'); navigate('/admin'); };

  return (
    <AdminCtx.Provider value={{ admin, refreshCounts }}>
      <div className="adm">
        <aside className={`adm-side ${nav ? 'open' : ''}`}>
          <div className="adm-brand">
            <img src="/images/brand/logo-white.png" alt="Quench Elegance" />
            <button className="icon-btn light adm-close" onClick={() => setNav(false)} aria-label="Close menu"><X size={20} /></button>
          </div>
          <nav>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <n.icon size={18} /> <span>{n.label}</span>
                {n.badge && counts[n.badge] > 0 && <em>{counts[n.badge]}</em>}
              </NavLink>
            ))}
          </nav>
          <div className="adm-side-foot">
            <a href="/" target="_blank" rel="noreferrer"><ExternalLink size={16} /> View website</a>
            <button onClick={logout}><LogOut size={16} /> Sign out</button>
          </div>
        </aside>
        {nav && <div className="adm-backdrop" onClick={() => setNav(false)} />}
        <div className="adm-main">
          <header className="adm-top">
            <button className="icon-btn adm-menu" onClick={() => setNav(true)} aria-label="Open menu"><Menu size={20} /></button>
            <span className="adm-hello">Welcome, <strong>{admin.name}</strong></span>
            <span className="adm-email">{admin.email}</span>
          </header>
          <div className="adm-content">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="requests" element={<Requests />} />
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductForm />} />
              <Route path="products/:id" element={<ProductForm />} />
              <Route path="messages" element={<Messages />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
