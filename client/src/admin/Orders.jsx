import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { adminApi, fmtDate, inr } from '../api';

const STATUSES = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

export default function Orders() {
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      adminApi.get(`/orders?q=${encodeURIComponent(q)}&status=${status}`).then((d) => setList(d.orders)).catch(() => setList([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status]);

  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Orders</h1></div>
      <div className="adm-filters">
        <label className="search-box"><Search size={16} /><input placeholder="Order no., customer, mobile, User ID" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="chips">
          <button className={`chip ${!status ? 'active' : ''}`} onClick={() => setStatus('')}>All</button>
          {STATUSES.map((s) => <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
      </div>
      <div className="adm-card no-pad">
        {!list ? <div className="page-loader"><div className="spinner" /></div> : list.length === 0 ? <div className="empty-state"><p>No orders found.</p></div> : (
          <div className="table-scroll">
            <table className="adm-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/admin/orders/${o.id}`} className="strong-link">#{o.orderNumber}</Link><div className="muted small">{fmtDate(o.createdAt, true)}</div></td>
                    <td>{o.customer.name}<div className="muted small">{o.customer.customerCode} · +91 {o.customer.phone}</div></td>
                    <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                    <td className="num">{inr(o.total)}</td>
                    <td className="small">{o.paymentMethod}<div className="muted">{o.paymentStatus}</div></td>
                    <td><span className={`status status-${o.status}`}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
