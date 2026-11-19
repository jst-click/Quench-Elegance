import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, ShoppingBag } from 'lucide-react';
import { api } from '../lib/api';
import { downloadCsv, fmtDate, inr, ORDER_STATUSES } from '../lib/format';
import { Avatar, EmptyState, PageHeader, PageLoader, SearchInput, StatusBadge, Tabs } from '../components/ui';
import { useToast } from '../components/feedback';

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const status = params.get('status') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [all, setAll] = useState(null);

  // Load every order once per search; status tabs filter client-side so tab counts stay accurate.
  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/orders?q=${encodeURIComponent(q)}`).then((d) => setAll(d.orders)).catch((e) => { toast(e.message, 'error'); setAll([]); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, toast]);

  const list = useMemo(() => (all || []).filter((o) => !status || o.status === status), [all, status]);
  const counts = useMemo(() => Object.fromEntries(ORDER_STATUSES.map((s) => [s, (all || []).filter((o) => o.status === s).length])), [all]);

  const setStatus = (s) => setParams(s ? { status: s } : {}, { replace: true });

  const exportCsv = () =>
    downloadCsv(`orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      { label: 'Order #', value: (o) => o.orderNumber },
      { label: 'Date', value: (o) => fmtDate(o.createdAt, true) },
      { label: 'Customer', value: (o) => o.customer.name },
      { label: 'User ID', value: (o) => o.customer.customerCode },
      { label: 'Mobile', value: (o) => o.customer.phone },
      { label: 'Items', value: (o) => o.items.map((i) => `${i.comboId ? '[Kit] ' : ''}${i.name} x${i.qty}`).join('; ') },
      { label: 'City', value: (o) => o.address?.city },
      { label: 'Total', value: (o) => o.total },
      { label: 'Payment', value: (o) => `${o.paymentMethod} (${o.paymentStatus})` },
      { label: 'Status', value: (o) => o.status },
      { label: 'Tracking', value: (o) => o.trackingNumber },
    ], list);

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        subtitle="Track, update and fulfil customer orders."
        actions={
          <>
            <button className="btn-outline" onClick={exportCsv} disabled={!list.length}><Download size={16} /> Export CSV</button>
            <Link to="/orders/new" className="btn-primary"><Plus size={16} /> Create order</Link>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[{ value: '', label: 'All', count: all?.length }, ...ORDER_STATUSES.map((s) => ({ value: s, label: s, count: all ? counts[s] : undefined }))]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Order #, name, mobile, User ID" className="lg:w-80" />
      </div>

      <div className="card overflow-hidden">
        {!all ? <PageLoader /> : list.length === 0 ? (
          <EmptyState icon={ShoppingBag} title={q || status ? 'No matching orders' : 'No orders yet'}>
            {q || status ? 'Try a different search or status.' : 'Orders placed on the website will appear here.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id} className="cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                    <td>
                      <Link to={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brown-800 hover:underline">#{o.orderNumber}</Link>
                      {o.source === 'admin' && <span className="ml-1.5 rounded-full bg-cream px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-brown-800" title={`Created by ${o.createdBy}`}>Admin</span>}
                      <div className="text-xs text-muted">{fmtDate(o.createdAt, true)}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={o.customer.name} className="size-8 text-[11px]" />
                        <div className="min-w-0">
                          <div className="truncate">{o.customer.name}</div>
                          <div className="text-xs text-muted">{o.customer.customerCode} · +91 {o.customer.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex -space-x-2">
                        {o.items.slice(0, 3).map((i) => (
                          <img key={i.comboId || i.productId} src={i.image} alt={i.name} title={`${i.name} × ${i.qty}`} className="size-8 rounded-full border-2 border-white bg-silver-100 object-cover" />
                        ))}
                        {o.items.length > 3 && <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-silver-200 text-[11px]">+{o.items.length - 3}</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted">{o.items.reduce((s, i) => s + i.qty, 0)} item(s)</div>
                    </td>
                    <td>
                      <div className="text-xs text-muted">{o.paymentMethod === 'Cash on Delivery' ? 'COD' : o.paymentMethod}</div>
                      <StatusBadge status={o.paymentStatus} />
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="text-right font-medium tabular-nums">{inr(o.total)}</td>
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
