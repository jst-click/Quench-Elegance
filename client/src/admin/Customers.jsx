import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { adminApi, fmtDate, inr } from '../api';
import { useToast } from '../context/AppContext';

export function CustomerModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name || '', phone: initial?.phone || '', email: initial?.email || '',
    customerCode: initial?.customerCode || '', notes: initial?.notes || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const d = editing ? await adminApi.put(`/customers/${initial.id}`, form) : await adminApi.post('/customers', form);
      toast(editing ? 'Customer updated' : `Customer added · User ID ${d.customer.customerCode}`);
      onSaved(d.customer);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-head"><h2>{editing ? 'Edit customer' : 'Add customer'}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <p className="muted small">Only registered mobile numbers can log in with OTP and place orders on the website.</p>
        <div className="form-grid">
          <div className="field span-2"><label>Full name *</label><input className="input" value={form.name} onChange={set('name')} required autoFocus /></div>
          <div className="field"><label>Mobile number *</label><input className="input" inputMode="tel" placeholder="10-digit mobile" value={form.phone} onChange={set('phone')} required /></div>
          <div className="field"><label>User ID</label><input className="input" placeholder={editing ? '' : 'Auto-generated if empty'} value={form.customerCode} onChange={set('customerCode')} /></div>
          <div className="field span-2"><label>Email</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
          <div className="field span-2"><label>Internal notes</label><textarea className="textarea" style={{ minHeight: 70 }} value={form.notes} onChange={set('notes')} /></div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(params.get('new') ? {} : null);

  const load = () => adminApi.get(`/customers?q=${encodeURIComponent(q)}&status=${status}`).then((d) => setList(d.customers)).catch(() => setList([]));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setModal(null); if (params.get('new')) setParams({}, { replace: true }); };

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Customers</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}><Plus size={16} /> Add customer</button>
      </div>
      <div className="adm-filters">
        <label className="search-box"><Search size={16} /><input placeholder="Search name, mobile, User ID" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All customers</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="adm-card no-pad">
        {!list ? <div className="page-loader"><div className="spinner" /></div> : list.length === 0 ? (
          <div className="empty-state"><h3>No customers yet</h3><p>Add a customer so they can log in with OTP and order.</p></div>
        ) : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead><tr><th>User ID</th><th>Name</th><th>Mobile</th><th>Orders</th><th>Spent</th><th>Status</th><th>Added</th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/admin/customers/${c.id}`} className="strong-link">{c.customerCode}</Link></td>
                    <td>{c.name}{c.email && <div className="muted small">{c.email}</div>}</td>
                    <td>+91 {c.phone}</td>
                    <td>{c.orders}</td>
                    <td className="num">{inr(c.spent)}</td>
                    <td><span className={`pill ${c.active ? 'pill-on' : 'pill-off'}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                    <td className="muted">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && <CustomerModal initial={modal} onClose={close} onSaved={() => { close(); load(); }} />}
    </div>
  );
}
