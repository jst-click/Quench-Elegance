import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Package, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../components/auth';
import { Alert } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-linear-to-br from-brown-900 via-brown-800 to-brown-950 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_420px_at_90%_0%,rgba(201,153,92,.25),transparent_60%),radial-gradient(520px_420px_at_0%_100%,rgba(201,153,92,.14),transparent_60%)]" />
        <div className="pointer-events-none absolute -right-24 top-1/3 size-[420px] rounded-full border border-gold/20" />
        <div className="pointer-events-none absolute -right-10 top-[42%] size-[300px] rounded-full border border-gold/15" />

        <img src="/admin/images/brand/logo-white.png" alt="Quench Elegance" className="relative h-14 w-auto self-start" />
        <div className="relative my-auto max-w-md">
          <p className="eyebrow !text-gold-soft">Admin Console</p>
          <h1 className="mt-4 text-6xl leading-[1.02] !text-white">
            Luxury care,<br /><em className="font-medium text-gold-soft">managed with ease.</em>
          </h1>
          <p className="mt-5 text-[15px] font-light leading-relaxed text-white/70">
            Orders, customers, products and messages for Quench Elegance — all in one calm, considered place.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/80">
            {[[Package, 'Catalogue, stock & pricing'], [Users, 'OTP customer access & approvals'], [ShieldCheck, 'Secure, session-based sign in']].map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full border border-gold/30 bg-white/5 text-gold-soft"><Icon size={16} /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs tracking-wide text-white/40">© {new Date().getFullYear()} Quench Elegance · Bengaluru</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-5 py-12">
        <form onSubmit={submit} className="card w-full max-w-[420px] animate-fade-up p-8 sm:p-10">
          <img src="/admin/images/brand/logo-brown.png" alt="Quench Elegance" className="mx-auto mb-6 h-14 w-auto lg:hidden" />
          <p className="eyebrow">Welcome back</p>
          <h2 className="mt-2 text-4xl">Sign in</h2>
          <p className="mt-2 text-sm text-muted">Use your admin email and password.</p>

          <div className="mt-7 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-silver-500" />
                <input id="email" type="email" className="input pl-10" autoComplete="username" autoFocus required
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@quenchelegance.com" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-silver-500" />
                <input id="password" type={show ? 'text' : 'password'} className="input px-10" autoComplete="current-password" required
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-silver-100" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="btn-primary w-full py-3 text-sm uppercase tracking-[.14em]" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
