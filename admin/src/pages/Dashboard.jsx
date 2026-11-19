import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Inbox, IndianRupee, Package, Plus, Receipt, ShoppingBag, UserPlus, Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, inr, ORDER_STATUSES, timeAgo } from '../lib/format';
import { Alert, Avatar, PageHeader, PageLoader, STATUS_DOT, StatusBadge } from '../components/ui';
import RevenueChart from '../components/RevenueChart';
import { useAuth } from '../components/auth';

function StatCard({ icon: Icon, label, value, sub, to, accent }) {
  const body = (
    <div className={`card card-pad group relative h-full overflow-hidden transition ${to ? 'hover:-translate-y-0.5 hover:shadow-card' : ''}`}>
      {accent && <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gold/15" />}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[.2em] text-muted">{label}</p>
          <p className="mt-2 truncate font-display text-[34px] font-semibold leading-none text-ink">{value}</p>
          {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
        </div>
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${accent ? 'bg-brown-800 text-gold-soft' : 'bg-cream text-brown-800'}`}>
          <Icon size={20} />
        </span>
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { admin } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/dashboard').then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!d) return <PageLoader />;
  const { stats, byStatus, days, topProducts, lowStock, recentOrders } = d;
  const totalOrders = ORDER_STATUSES.reduce((s, k) => s + (byStatus[k] || 0), 0);
  const last14 = days.reduce((s, x) => s + x.revenue, 0);
  const openOrders = (byStatus.Placed || 0) + (byStatus.Confirmed || 0) + (byStatus.Packed || 0);
  const topMax = Math.max(...topProducts.map((p) => p.revenue), 1);

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title={`Hello, ${admin.name.split(' ')[0]}`}
        subtitle="Here's how Quench Elegance is doing today."
        actions={
          <>
            <Link to="/customers?new=1" className="btn-outline"><Plus size={16} /> Customer</Link>
            <Link to="/products/new" className="btn-primary"><Plus size={16} /> Product</Link>
          </>
        }
      />

      {(stats.pendingRequests > 0 || stats.unreadMessages > 0 || openOrders > 0) && (
        <div className="mb-6 grid animate-fade-up gap-3 md:grid-cols-3">
          {openOrders > 0 && (
            <Link to="/orders?status=Placed" className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-cream/70 px-4 py-3 text-sm transition hover:bg-cream">
              <ShoppingBag size={18} className="text-brown-700" />
              <span className="flex-1"><strong>{openOrders}</strong> order{openOrders > 1 ? 's' : ''} to process</span>
              <ArrowRight size={16} className="text-brown-700" />
            </Link>
          )}
          {stats.pendingRequests > 0 && (
            <Link to="/requests" className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-cream/70 px-4 py-3 text-sm transition hover:bg-cream">
              <UserPlus size={18} className="text-brown-700" />
              <span className="flex-1"><strong>{stats.pendingRequests}</strong> registration request{stats.pendingRequests > 1 ? 's' : ''} waiting</span>
              <ArrowRight size={16} className="text-brown-700" />
            </Link>
          )}
          {stats.unreadMessages > 0 && (
            <Link to="/messages" className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-cream/70 px-4 py-3 text-sm transition hover:bg-cream">
              <Inbox size={18} className="text-brown-700" />
              <span className="flex-1"><strong>{stats.unreadMessages}</strong> unread message{stats.unreadMessages > 1 ? 's' : ''}</span>
              <ArrowRight size={16} className="text-brown-700" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label="Revenue" value={inr(stats.revenue)} sub="All time, excl. cancelled" accent />
        <StatCard icon={ShoppingBag} label="Orders" value={stats.orders} sub={`Avg. order ${inr(stats.avgOrder)}`} to="/orders" />
        <StatCard icon={Users} label="Customers" value={stats.customers} sub="Registered for OTP login" to="/customers" />
        <StatCard icon={Package} label="Products" value={stats.products} sub={lowStock.length ? `${lowStock.length} low on stock` : 'Stock healthy'} to="/products" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card card-pad xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="card-title">Revenue · last 14 days</h2>
              <p className="text-sm text-muted">{inr(last14)} from {days.reduce((s, x) => s + x.orders, 0)} orders</p>
            </div>
          </div>
          <RevenueChart days={days} />
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Orders by status</h2>
          <p className="text-sm text-muted">{totalOrders} total</p>
          {totalOrders > 0 && (
            <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-silver-200">
              {ORDER_STATUSES.filter((s) => byStatus[s]).map((s) => (
                <span key={s} title={`${s}: ${byStatus[s]}`} style={{ width: `${(byStatus[s] / totalOrders) * 100}%`, background: STATUS_DOT[s] }} className="border-r-2 border-white last:border-r-0" />
              ))}
            </div>
          )}
          <ul className="mt-5 space-y-1">
            {ORDER_STATUSES.map((s) => (
              <li key={s}>
                <Link to={`/orders?status=${s}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-white/70">
                  <span className="size-2.5 rounded-full" style={{ background: STATUS_DOT[s] }} />
                  <span className="flex-1 text-ink-2">{s}</span>
                  <span className="font-medium tabular-nums">{byStatus[s] || 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3 sm:p-6 sm:pb-3">
            <h2 className="card-title">Recent orders</h2>
            <Link to="/orders" className="link text-sm">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="px-6 pb-8 text-sm text-muted">No orders yet. They'll appear here as customers check out.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="font-medium text-brown-800 hover:underline">#{o.orderNumber}</Link>
                        <div className="text-xs text-muted">{timeAgo(o.createdAt)}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={o.customer.name} className="size-8 text-[11px]" />
                          <span className="truncate">{o.customer.name}</span>
                        </div>
                      </td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-right font-medium tabular-nums">{inr(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="card-title">Top products</h2>
            {topProducts.length === 0 ? <p className="mt-2 text-sm text-muted">No sales yet.</p> : (
              <ul className="mt-4 space-y-4">
                {topProducts.map((p, i) => (
                  <li key={p.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate"><span className="mr-2 font-display text-base text-bronze">{String(i + 1).padStart(2, '0')}</span>{p.name}</span>
                      <span className="shrink-0 font-medium tabular-nums">{inr(p.revenue)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-silver-200">
                        <div className="h-full rounded-full bg-linear-to-r from-brown-700 to-bronze" style={{ width: `${(p.revenue / topMax) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted">{p.qty} sold</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card card-pad">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-warning" />
              <h2 className="card-title">Low stock</h2>
            </div>
            {lowStock.length === 0 ? <p className="mt-2 text-sm text-muted">All active products have more than 10 in stock.</p> : (
              <ul className="mt-3 divide-y divide-silver-200">
                {lowStock.map((p) => (
                  <li key={p.id}>
                    <Link to={`/products/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brown-800">
                      <span className="truncate">{p.name}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${p.stock === 0 ? 'bg-[#f5e0de] text-danger' : 'bg-[#efe6d6] text-warning'}`}>
                        {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
        <Receipt size={13} /> Figures update live from the store · {fmtDate(new Date(), true)}
      </p>
    </div>
  );
}
