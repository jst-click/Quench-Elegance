import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, FileText, MapPin, Phone, Printer, User } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, inr, ORDER_STATUSES, PAYMENT_STATUSES } from '../lib/format';
import { Alert, Field, PageHeader, PageLoader, STATUS_DOT, StatusBadge } from '../components/ui';
import { useConfirm, useToast } from '../components/feedback';

const FLOW = ORDER_STATUSES.filter((s) => s !== 'Cancelled');

function Progress({ status }) {
  if (status === 'Cancelled') return <Alert>This order was cancelled. Stock has been returned to inventory.</Alert>;
  const at = FLOW.indexOf(status);
  return (
    <div className="card card-pad">
      <ol className="flex items-start">
        {FLOW.map((s, i) => (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${i <= at ? 'bg-brown-700' : 'bg-silver-300'}`} />}
            <span className={`relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-semibold transition ${i < at ? 'border-brown-700 bg-brown-700 text-white' : i === at ? 'border-gold bg-brown-800 text-gold-soft ring-4 ring-gold/25' : 'border-silver-300 bg-white text-muted'}`}>
              {i < at ? <Check size={15} /> : i + 1}
            </span>
            <span className={`mt-2 text-[11px] sm:text-xs ${i <= at ? 'font-medium text-ink' : 'text-muted'}`}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const fill = (o) => {
    setOrder(o);
    setForm({ status: o.status, note: '', trackingNumber: o.trackingNumber || '', paymentStatus: o.paymentStatus, adminNotes: o.adminNotes || '' });
  };
  useEffect(() => { api.get(`/orders/${id}`).then((d) => fill(d.order)).catch((e) => setError(e.message)); }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!order) return <PageLoader />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    if (form.status === 'Cancelled' && order.status !== 'Cancelled') {
      const ok = await confirm({ title: 'Cancel this order?', body: 'Stock for every item will be returned to inventory. A cancelled order cannot be reopened.', confirmLabel: 'Cancel order', danger: true });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const d = await api.put(`/orders/${id}`, form);
      fill(d.order);
      toast('Order updated');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const nextStatus = FLOW[FLOW.indexOf(order.status) + 1];
  const quickAdvance = async () => {
    setSaving(true);
    try {
      const d = await api.put(`/orders/${id}`, { status: nextStatus, note: '' });
      fill(d.order);
      toast(`Marked as ${nextStatus}`);
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };

  const a = order.address || {};
  const c = order.customer;
  return (
    <div>
      <PageHeader
        back={{ to: '/orders', label: 'Orders' }}
        eyebrow="Order"
        title={`#${order.orderNumber}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {order.source === 'admin' ? `Created by ${order.createdBy || 'admin'}` : 'Placed'} {fmtDate(order.createdAt, true)} <StatusBadge status={order.status} />
            {order.invoiceNumber && <Link to={`/invoices/${order.id}`} className="link font-mono text-xs">{order.invoiceNumber}</Link>}
          </span>
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => window.print()}><Printer size={16} /> Print</button>
            {order.invoiceNumber && <Link className="btn-outline" to={`/invoices/${order.id}`}><FileText size={16} /> Invoice</Link>}
            {nextStatus && order.status !== 'Cancelled' && (
              <button className="btn-primary" onClick={quickAdvance} disabled={saving}><Check size={16} /> Mark {nextStatus}</button>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Progress status={order.status} />

          <section className="card">
            <h2 className="card-title p-5 pb-2 sm:p-6 sm:pb-2">Items</h2>
            <ul className="divide-y divide-silver-200/80 px-5 sm:px-6">
              {order.items.map((i) => (
                <li key={i.comboId || i.productId} className="flex items-center gap-4 py-4">
                  <img src={i.image} alt="" className="size-16 shrink-0 rounded-xl bg-silver-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {i.comboId && <span className="mr-2 rounded-full bg-brown-800 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-gold-soft">Kit</span>}
                      {i.name}
                    </p>
                    <p className="text-xs text-muted">{i.size}</p>
                    {i.components && (
                      <p className="mt-1 text-xs text-ink-2">Contains: {i.components.map((c) => `${c.name} × ${c.qty * i.qty}`).join(' · ')}</p>
                    )}
                    <p className="mt-1 text-sm text-muted">{inr(i.price)} × {i.qty}</p>
                  </div>
                  <p className="font-medium tabular-nums">{inr(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 rounded-b-2xl border-t border-silver-200 bg-silver-50/70 px-5 py-4 text-sm sm:px-6">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{inr(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="tabular-nums">− {inr(order.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd className="tabular-nums">{order.shipping ? inr(order.shipping) : 'Free'}</dd></div>
              <div className="flex justify-between border-t border-silver-200 pt-2 font-display text-xl font-semibold"><dt>Total</dt><dd className="tabular-nums">{inr(order.total)}</dd></div>
              <div className="flex justify-between text-xs text-muted"><dt>{order.paymentMethod}</dt><dd><StatusBadge status={order.paymentStatus} /></dd></div>
            </dl>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="card card-pad">
              <h2 className="card-title mb-3 flex items-center gap-2"><User size={18} className="text-bronze" /> Customer</h2>
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-sm text-muted">User ID {c.customerCode}</p>
              <p className="text-sm text-muted">+91 {c.phone}</p>
              {c.email && <p className="text-sm text-muted">{c.email}</p>}
              <div className="mt-4 flex flex-wrap gap-2 no-print">
                <Link to={`/customers/${order.customerId}`} className="btn-outline btn-sm">View profile</Link>
                <a href={`tel:+91${c.phone}`} className="btn-ghost btn-sm"><Phone size={14} /> Call</a>
              </div>
            </section>
            <section className="card card-pad">
              <h2 className="card-title mb-3 flex items-center gap-2"><MapPin size={18} className="text-bronze" /> Ship to</h2>
              <p className="font-medium">{a.name}</p>
              <p className="text-sm text-muted">{a.phone}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">
                {a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}, {a.state} – {a.pincode}
              </p>
            </section>
          </div>

          {order.notes && (
            <section className="card card-pad">
              <h2 className="card-title mb-2">Customer note</h2>
              <p className="text-sm text-ink-2">{order.notes}</p>
            </section>
          )}
        </div>

        <aside className="space-y-5 no-print">
          <form className="card card-pad space-y-4" onSubmit={save}>
            <h2 className="card-title">Update order</h2>
            <Field label="Status">
              <select className="input" value={form.status} onChange={set('status')} disabled={order.status === 'Cancelled'}>
                {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Note for this update" hint="Shown to the customer in their order history.">
              <input className="input" value={form.note} onChange={set('note')} placeholder="e.g. Dispatched via Delhivery" />
            </Field>
            <Field label="Tracking / AWB number">
              <input className="input" value={form.trackingNumber} onChange={set('trackingNumber')} />
            </Field>
            <Field label="Payment status">
              <select className="input" value={form.paymentStatus} onChange={set('paymentStatus')}>
                {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Internal notes" hint="Only visible to admins.">
              <textarea className="input !min-h-20" value={form.adminNotes} onChange={set('adminNotes')} />
            </Field>
            <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </form>

          <section className="card card-pad">
            <h2 className="card-title mb-4">Timeline</h2>
            <ol className="relative space-y-5 border-l border-silver-300 pl-5">
              {[...order.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[26px] top-1 size-3 rounded-full ring-4 ring-white" style={{ background: STATUS_DOT[h.status] || '#999' }} />
                  <p className="text-sm font-medium">{h.status}</p>
                  <p className="text-xs text-muted">{fmtDate(h.at, true)}{h.by ? ` · ${h.by}` : ''}</p>
                  {h.note && <p className="mt-1 rounded-lg bg-silver-50 px-2.5 py-1.5 text-sm text-ink-2">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
