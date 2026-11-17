import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Power, Trash2 } from 'lucide-react';
import { adminApi, fmtDate, inr } from '../api';
import { useToast } from '../context/AppContext';
import { CustomerModal } from './Customers';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(false);

  const load = () => adminApi.get(`/customers/${id}`).then(setData).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div className="page-loader"><div className="spinner" /></div>;
  const { customer: c, orders } = data;
  const spent = orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);

  const toggle = async () => {
    await adminApi.put(`/customers/${id}`, { active: !c.active });
    toast(c.active ? 'Customer deactivated — they can no longer log in' : 'Customer activated');
    load();
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    const d = await adminApi.del(`/customers/${id}`);
    toast(d.message);
    if (d.deactivated) load(); else navigate('/admin/customers');
  };

  return (
    <div className="adm-page">
      <Link to="/admin/customers" className="back-link"><ArrowLeft size={16} /> Customers</Link>
      <div className="adm-head">
        <div><h1>{c.name}</h1><p className="muted">User ID <strong>{c.customerCode}</strong> · +91 {c.phone}</p></div>
        <div className="adm-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setEdit(true)}><Pencil size={15} /> Edit</button>
          <button className="btn btn-outline btn-sm" onClick={toggle}><Power size={15} /> {c.active ? 'Deactivate' : 'Activate'}</button>
          <button className="btn btn-outline btn-sm danger" onClick={remove}><Trash2 size={15} /> Delete</button>
        </div>
      </div>

      <div className="stat-grid three">
        <div className="stat-tile"><span className="stat-label">Status</span><strong className="stat-value">{c.active ? 'Active' : 'Inactive'}</strong><span className="stat-sub">{c.lastLoginAt ? `Last login ${fmtDate(c.lastLoginAt, true)}` : 'Never logged in'}</span></div>
        <div className="stat-tile"><span className="stat-label">Orders</span><strong className="stat-value">{orders.length}</strong><span className="stat-sub">Since {fmtDate(c.createdAt)}</span></div>
        <div className="stat-tile"><span className="stat-label">Total spent</span><strong className="stat-value">{inr(spent)}</strong><span className="stat-sub">Excluding cancelled</span></div>
      </div>

      <div className="adm-grid-2">
        <section className="adm-card">
          <h2>Orders</h2>
          {orders.length === 0 ? <p className="muted">No orders yet.</p> : (
            <table className="adm-table compact">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="strong-link" to={`/admin/orders/${o.id}`}>#{o.orderNumber}</Link><div className="muted small">{fmtDate(o.createdAt, true)}</div></td>
                    <td><span className={`status status-${o.status}`}>{o.status}</span></td>
                    <td className="num">{inr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="adm-card">
          <h2>Details</h2>
          <dl className="kv">
            <dt>Email</dt><dd>{c.email || '—'}</dd>
            <dt>Notes</dt><dd>{c.notes || '—'}</dd>
            <dt>Saved addresses</dt>
            <dd>{(c.addresses || []).length ? c.addresses.map((a) => <p key={a.id}>{a.name}, {a.line1}, {a.city}, {a.state} – {a.pincode}</p>) : '—'}</dd>
          </dl>
        </section>
      </div>
      {edit && <CustomerModal initial={c} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} />}
    </div>
  );
}
