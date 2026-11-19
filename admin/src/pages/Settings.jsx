import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Alert, Avatar, Field, PageHeader } from '../components/ui';
import { useToast } from '../components/feedback';
import { useAuth } from '../components/auth';

export default function Settings() {
  const { admin, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const strength = (() => {
    const p = form.newPassword;
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  })();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) return setError('New password must be at least 8 characters.');
    if (form.newPassword !== form.confirm) return setError('New passwords do not match.');
    setSaving(true);
    try {
      await api.put('/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Account" title="Settings" subtitle="Your admin profile and password." />
      <div className="grid max-w-5xl gap-5 lg:grid-cols-[320px_1fr]">
        <section className="card card-pad relative h-fit overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-br from-brown-900 via-brown-800 to-brown-700" />
          <div className="relative pt-8 text-center">
            <Avatar name={admin.name} className="mx-auto size-20 text-2xl ring-4 ring-white" />
            <h2 className="mt-3 text-2xl">{admin.name}</h2>
            <p className="text-sm text-muted">{admin.email}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-xs font-medium text-brown-800"><ShieldCheck size={13} /> Administrator</span>
            <p className="mt-5 text-xs text-muted">Sessions last 12 hours. Sign out on shared computers.</p>
            <button className="btn-outline mt-3 w-full" onClick={logout}>Sign out</button>
          </div>
        </section>

        <form className="card card-pad" onSubmit={submit}>
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-cream text-brown-800"><KeyRound size={20} /></span>
            <div>
              <h2 className="card-title">Change password</h2>
              <p className="text-sm text-muted">Use at least 8 characters with a mix of letters, numbers and symbols.</p>
            </div>
          </div>
          <div className="grid max-w-md gap-4">
            <Field label="Current password">
              <input type="password" className="input" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} required />
            </Field>
            <Field label="New password">
              <input type="password" className="input" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} required />
              {form.newPassword && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? ['bg-danger', 'bg-warning', 'bg-bronze', 'bg-success'][strength - 1] : 'bg-silver-200'}`} />
                    ))}
                  </div>
                  <span className="w-12 text-right text-xs text-muted">{['Weak', 'Weak', 'Fair', 'Good', 'Strong'][strength]}</span>
                </div>
              )}
            </Field>
            <Field label="Confirm new password">
              <input type="password" className="input" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
            </Field>
            {error && <Alert>{error}</Alert>}
            <div><button className="btn-primary" disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button></div>
          </div>
        </form>
      </div>
    </div>
  );
}
