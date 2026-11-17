import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, IndianRupee, Inbox, Package, ShoppingCart, UserPlus, Users } from 'lucide-react';
import { adminApi, fmtDate, inr } from '../api';

function RevenueChart({ days }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const ticks = [max, max / 2, 0];
  return (
    <div className="chart">
      <div className="chart-plot">
        <div className="chart-axis">
          {ticks.map((t, i) => <span key={i}>{inr(Math.round(t))}</span>)}
        </div>
        <div className="chart-bars" onMouseLeave={() => setHover(null)}>
          <div className="chart-grid"><i /><i /><i /></div>
          {days.map((d, i) => (
            <div key={d.date} className={`chart-col ${hover === i ? 'hover' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${fmtDate(d.date)}: ${inr(d.revenue)} from ${d.orders} orders`}>
              <div className="chart-bar" style={{ height: `${(d.revenue / max) * 100}%` }} />
              {hover === i && (
                <div className={`chart-tip ${i > days.length - 4 ? 'left' : ''}`}>
                  <strong>{inr(d.revenue)}</strong>
                  <span>{d.orders} order{d.orders === 1 ? '' : 's'} · {fmtDate(d.date)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="chart-x">
        {days.map((d, i) => <span key={d.date}>{i % 2 === 0 ? new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</span>)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { adminApi.get('/dashboard').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="page-loader"><div className="spinner" /></div>;
  const s = data.stats;

  const tiles = [
    { label: 'Revenue', value: inr(s.revenue), sub: `Avg order ${inr(s.avgOrder)}`, icon: IndianRupee, to: '/admin/orders' },
    { label: 'Orders', value: s.orders, sub: `${data.byStatus.Placed || 0} awaiting confirmation`, icon: ShoppingCart, to: '/admin/orders' },
    { label: 'Customers', value: s.customers, sub: 'Registered users', icon: Users, to: '/admin/customers' },
    { label: 'Products', value: s.products, sub: `${data.lowStock.length} low on stock`, icon: Package, to: '/admin/products' },
  ];

  return (
    <div className="adm-page">
      <div className="adm-head"><h1>Dashboard</h1><Link to="/admin/customers?new=1" className="btn btn-primary btn-sm"><UserPlus size={16} /> Add customer</Link></div>

      {(s.pendingRequests > 0 || s.unreadMessages > 0) && (
        <div className="adm-notices">
          {s.pendingRequests > 0 && <Link to="/admin/requests" className="alert alert-info"><UserPlus size={16} /> {s.pendingRequests} new registration request{s.pendingRequests > 1 ? 's' : ''} waiting for approval →</Link>}
          {s.unreadMessages > 0 && <Link to="/admin/messages" className="alert alert-info"><Inbox size={16} /> {s.unreadMessages} unread message{s.unreadMessages > 1 ? 's' : ''} →</Link>}
        </div>
      )}

      <div className="stat-grid">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="stat-tile">
            <span className="stat-icon"><t.icon size={20} /></span>
            <span className="stat-label">{t.label}</span>
            <strong className="stat-value">{t.value}</strong>
            <span className="stat-sub">{t.sub}</span>
          </Link>
        ))}
      </div>

      <div className="adm-grid-2">
        <section className="adm-card">
          <h2>Revenue · last 14 days</h2>
          <RevenueChart days={data.days} />
        </section>
        <section className="adm-card">
          <h2>Orders by status</h2>
          <ul className="status-list">
            {Object.entries(data.byStatus).map(([k, v]) => (
              <li key={k}><span className={`status status-${k}`}>{k}</span><strong>{v}</strong></li>
            ))}
          </ul>
        </section>
      </div>

      <div className="adm-grid-2">
        <section className="adm-card">
          <div className="adm-card-head"><h2>Recent orders</h2><Link to="/admin/orders" className="btn-link">View all</Link></div>
          {data.recentOrders.length === 0 ? <p className="muted">No orders yet.</p> : (
            <table className="adm-table compact">
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/admin/orders/${o.id}`} className="strong-link">#{o.orderNumber}</Link><div className="muted small">{fmtDate(o.createdAt, true)}</div></td>
                    <td>{o.customer.name}<div className="muted small">{o.customer.customerCode}</div></td>
                    <td><span className={`status status-${o.status}`}>{o.status}</span></td>
                    <td className="num">{inr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="adm-card">
          <h2>Top products</h2>
          {data.topProducts.length === 0 ? <p className="muted">Sales will appear here.</p> : (
            <ul className="rank-list">
              {data.topProducts.map((p, i) => (
                <li key={p.name}><span className="rank">{i + 1}</span><span className="rank-name">{p.name}<small>{p.qty} sold</small></span><strong>{inr(p.revenue)}</strong></li>
              ))}
            </ul>
          )}
          {data.lowStock.length > 0 && (
            <>
              <h3 className="adm-sub"><AlertTriangle size={16} /> Low stock</h3>
              <ul className="rank-list">
                {data.lowStock.map((p) => <li key={p.id}><Link to={`/admin/products/${p.id}`} className="rank-name">{p.name}</Link><strong className={p.stock <= 0 ? 'text-danger' : ''}>{p.stock} left</strong></li>)}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
