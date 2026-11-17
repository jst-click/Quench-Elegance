import { useState } from 'react';
import { adminApi } from '../api';
import { useToast } from '../context/AppContext';
import { useAdmin } from './AdminApp';

export default function AdminSettings() {
  const { admin } = useAdmin();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await adminApi.put('/password', form);
      toast('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Settings</h1></div>
      <div className="adm-grid-2">
        <form className="adm-card form-stack" onSubmit={submit}>
          <h2>Change password</h2>
          <p className="muted small">Signed in as {admin.email}</p>
          <div className="field"><label>Current password</label><input type="password" className="input" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required /></div>
          <div className="field"><label>New password (min 8 characters)</label><input type="password" className="input" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required minLength={8} /></div>
          <div className="field"><label>Confirm new password</label><input type="password" className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Update password'}</button>
        </form>
        <section className="adm-card">
          <h2>How customer login works</h2>
          <ol className="howto">
            <li>Add a customer under <strong>Customers</strong> with their name, mobile number and (optionally) a User ID.</li>
            <li>The customer opens the website, chooses <strong>Login</strong>, and enters that mobile number.</li>
            <li>They receive a 6-digit OTP and can then check out and track orders.</li>
            <li>Numbers that aren't registered can send a <strong>registration request</strong>, which you approve or reject.</li>
            <li>Deactivating a customer blocks their login immediately.</li>
          </ol>
          <p className="muted small">SMS delivery is configured in <code>server/.env</code> (OTP_PROVIDER=msg91). Until then OTPs are shown on screen and printed in the server log for testing.</p>
        </section>
      </div>
    </div>
  );
}
