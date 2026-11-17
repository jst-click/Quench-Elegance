import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { adminApi, fmtDate, inr } from '../api';
import { useToast } from '../context/AppContext';

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [form, setForm] = useState({ status: '', note: '', trackingNumber: '', paymentStatus: '', adminNotes: '' });
  const [saving, setSaving] = useState(false);

  const fill = (o) => { setOrder(o); setForm({ status: o.status, note: '', trackingNumber: o.trackingNumber || '', paymentStatus: o.paymentStatus, adminNotes: o.adminNotes || '' }); };
  useEffect(() => { adminApi.get(`/orders/${id}`).then((d) => { fill(d.order); setStatuses(d.statuses); }).catch((e) => toast(e.message, 'error')); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return <div className="page-loader"><div className="spinner" /></div>;

  const save = async (e) => {
    e.preventDefault();
    if (form.status === 'Cancelled' && order.status !== 'Cancelled' && !window.confirm('Cancel this order? Stock will be returned to inventory.')) return;
    setSaving(true);
    try {
      const d = await adminApi.put(`/orders/${id}`, form);
      fill(d.order);
      toast('Order updated');
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };

  const a = order.address;
  return (
    <div className="adm-page">
      <Link to="/admin/orders" className="back-link"><ArrowLeft size={16} /> Orders</Link>
      <div className="adm-head">
        <div><h1>Order #{order.orderNumber}</h1><p className="muted">{fmtDate(order.createdAt, true)}</p></div>
        <div className="adm-actions">
          <span className={`status status-${order.status}`}>{order.status}</span>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Printer size={15} /> Print</button>
        </div>
      </div>

      <div className="pf-layout">
        <div className="pf-main">
          <section className="adm-card">
            <h2>Items</h2>
            <table className="adm-table compact">
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.productId}>
                    <td><div className="prod-cell"><img src={i.image} alt="" /><span><strong>{i.name}</strong><small>{i.size}</small></span></div></td>
                    <td>{inr(i.price)} × {i.qty}</td>
                    <td className="num">{inr(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>Subtotal</td><td className="num">{inr(order.subtotal)}</td></tr>
                <tr><td colSpan={2}>Shipping</td><td className="num">{order.shipping ? inr(order.shipping) : 'Free'}</td></tr>
                <tr className="total"><td colSpan={2}>Total</td><td className="num">{inr(order.total)}</td></tr>
              </tfoot>
            </table>
          </section>
          <div className="adm-grid-2 tight">
            <section className="adm-card">
              <h2>Customer</h2>
              <p><strong>{order.customer.name}</strong></p>
              <p className="muted">User ID {order.customer.customerCode}<br />+91 {order.customer.phone}{order.customer.email && <><br />{order.customer.email}</>}</p>
              <Link className="btn-link" to={`/admin/customers/${order.customerId}`}>View customer</Link>
            </section>
            <section className="adm-card">
              <h2>Shipping address</h2>
              <p><strong>{a.name}</strong> · {a.phone}</p>
              <p className="muted">{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}, {a.state} – {a.pincode}</p>
            </section>
          </div>
          {order.notes && <section className="adm-card"><h2>Customer note</h2><p>{order.notes}</p></section>}
        </div>

        <aside className="pf-side">
          <form className="adm-card" onSubmit={save}>
            <h2>Update order</h2>
            <div className="field"><label>Status</label>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={order.status === 'Cancelled'}>
                {statuses.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Note for this update</label><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Visible to customer" /></div>
            <div className="field"><label>Tracking / AWB number</label><input className="input" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} /></div>
            <div className="field"><label>Payment status</label>
              <select className="select" value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
                {['Pending', 'Paid', 'Refunded'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="field"><label>Internal notes</label><textarea className="textarea" style={{ minHeight: 70 }} value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} /></div>
            <button className="btn btn-primary btn-sm btn-block" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </form>
          <section className="adm-card">
            <h2>History</h2>
            <ul className="history">
              {[...order.history].reverse().map((h, i) => <li key={i}><span className={`status status-${h.status}`}>{h.status}</span> <span className="muted small">{fmtDate(h.at, true)}{h.by ? ` · ${h.by}` : ''}</span>{h.note && <p>{h.note}</p>}</li>)}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
