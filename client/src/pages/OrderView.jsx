import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Copy, CreditCard, FileText, MapPin, MessageCircle, Package, PackageCheck, ShieldCheck, Truck, XCircle } from 'lucide-react';
import { api, fmtDate, inr } from '../api';
import { useAuth, useToast } from '../context/AppContext';
import { whatsappLink } from '../content';
import { Loader } from '../components/ui';
import '../styles/orders.css';

export const FLOW = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];
const STEP_ICON = { Placed: Package, Confirmed: ShieldCheck, Packed: PackageCheck, Shipped: Truck, Delivered: CheckCircle2 };
const STATUS_TEXT = {
  Placed: 'We have received your order and will confirm it shortly.',
  Confirmed: 'Your order is confirmed and is being prepared.',
  Packed: 'Your order is packed and will be handed to the courier soon.',
  Shipped: 'Your order is on its way to you.',
  Delivered: 'Your order has been delivered. Enjoy your ritual!',
  Cancelled: 'This order was cancelled.',
};

/** Compact progress used on order cards. */
export function MiniTracker({ status }) {
  if (status === 'Cancelled') return <div className="mini-track cancelled"><XCircle size={14} /> Cancelled</div>;
  const at = FLOW.indexOf(status);
  return (
    <div className="mini-track" aria-label={`Order status: ${status}`}>
      <div className="mini-track-bar"><span style={{ width: `${(at / (FLOW.length - 1)) * 100}%` }} /></div>
      <div className="mini-track-labels">
        {FLOW.map((s, i) => <span key={s} className={i <= at ? 'on' : ''}>{s}</span>)}
      </div>
    </div>
  );
}

export default function OrderView() {
  const { id } = useParams();
  const { customer, ready } = useAuth();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) api.get(`/api/orders/${id}`).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [id, customer]);

  if (!ready) return <Loader />;
  if (!customer) return <Navigate to={`/login?next=/account/orders/${id}`} replace />;
  if (error) return <div className="container section"><div className="alert alert-error">{error}</div></div>;
  if (!order) return <Loader />;

  const cancelled = order.status === 'Cancelled';
  const step = FLOW.indexOf(order.status);
  const reachedAt = {}; // first time each status was reached
  order.history.forEach((h) => { if (!reachedAt[h.status]) reachedAt[h.status] = h.at; });
  const a = order.address;
  const units = order.items.reduce((s, i) => s + i.qty, 0);

  const copyTracking = () => {
    navigator.clipboard?.writeText(order.trackingNumber).then(() => toast('Tracking number copied')).catch(() => {});
  };

  return (
    <section className="section">
      <div className="container">
        <Link to="/account" className="back-link"><ArrowLeft size={16} /> My orders</Link>

        <div className="ov-head">
          <div>
            <span className="eyebrow">Order details</span>
            <h1 className="page-title">Order #{order.orderNumber}</h1>
            <p className="muted">
              {order.source === 'admin' ? 'Placed for you by the Quench Elegance team' : 'Placed'} on {fmtDate(order.createdAt, true)} · {units} item{units === 1 ? '' : 's'}
              {order.invoiceNumber && <> · Invoice {order.invoiceNumber}</>}
            </p>
          </div>
          <span className={`status status-${order.status} ov-status`}>{order.status}</span>
        </div>

        {/* ---------- Tracking ---------- */}
        <div className={`card ov-track ${cancelled ? 'is-cancelled' : ''}`}>
          <div className="ov-track-now">
            <span className="ov-track-icon">{cancelled ? <XCircle size={22} /> : (() => { const I = STEP_ICON[order.status] || Package; return <I size={22} />; })()}</span>
            <div>
              <strong>{cancelled ? 'Order cancelled' : order.status === 'Delivered' ? 'Delivered' : `Order ${order.status.toLowerCase()}`}</strong>
              <p className="muted">{STATUS_TEXT[order.status]}</p>
            </div>
            {order.trackingNumber && (
              <button type="button" className="ov-awb" onClick={copyTracking} title="Copy tracking number">
                <span>Tracking / AWB</span><strong>{order.trackingNumber}</strong><Copy size={14} />
              </button>
            )}
          </div>

          {!cancelled && (
            <ol className="ov-steps">
              {FLOW.map((s, i) => {
                const Icon = STEP_ICON[s];
                const state = i < step ? 'done' : i === step ? 'current' : 'todo';
                return (
                  <li key={s} className={`ov-step ${state}`}>
                    <span className="ov-step-dot">{state === 'done' ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}</span>
                    <span className="ov-step-name">{s}</span>
                    <span className="ov-step-date">{reachedAt[s] ? fmtDate(reachedAt[s]) : state === 'todo' ? '—' : ''}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="ov-grid">
          <div className="ov-main">
            {/* Items */}
            <div className="card ov-card">
              <h3>Items in this order</h3>
              {order.items.map((i) => (
                <div key={i.comboId || i.productId} className="ov-item">
                  <Link to={i.comboId ? `/combo/${i.slug}` : `/product/${i.slug}`} className="ov-item-img"><img src={i.image} alt="" /></Link>
                  <div className="ov-item-info">
                    <Link to={i.comboId ? `/combo/${i.slug}` : `/product/${i.slug}`} className="ov-item-name">{i.comboId && <span className="kit-badge">Kit</span>}{i.name}</Link>
                    <span className="muted small">{[i.size, `${inr(i.price)} × ${i.qty}`].filter(Boolean).join(' · ')}</span>
                    {i.components && <span className="muted small">Includes {i.components.map((c) => `${c.name} × ${c.qty * i.qty}`).join(' · ')}</span>}
                  </div>
                  <strong>{inr(i.lineTotal)}</strong>
                </div>
              ))}
              {order.notes && <p className="ov-note">Note: {order.notes}</p>}
            </div>

            {/* Timeline */}
            <div className="card ov-card">
              <h3>Order timeline</h3>
              <ol className="ov-timeline">
                {[...order.history].reverse().map((h, i) => (
                  <li key={i} className={i === 0 ? 'latest' : ''}>
                    <span className={`ov-tl-dot status-${h.status}`} />
                    <div>
                      <strong>{h.status}</strong>
                      <span className="muted small"> · {fmtDate(h.at, true)}</span>
                      {h.note && <p>{h.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <aside className="ov-side">
            <div className="card ov-card">
              <h3>Payment summary</h3>
              <div className="summary-row"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="summary-row ov-discount"><span>Discount</span><span>− {inr(order.discount)}</span></div>}
              <div className="summary-row"><span>Shipping</span><span>{order.shipping ? inr(order.shipping) : 'Free'}</span></div>
              <div className="summary-row total"><span>Total</span><strong>{inr(order.total)}</strong></div>
              <div className="ov-pay"><CreditCard size={16} /> {order.paymentMethod} <span className={`status status-${order.paymentStatus === 'Paid' ? 'Delivered' : order.paymentStatus === 'Refunded' ? 'Confirmed' : 'Placed'}`}>{order.paymentStatus}</span></div>
              {order.invoiceNumber && <p className="ov-invoice"><FileText size={14} /> Invoice {order.invoiceNumber}</p>}
            </div>
            <div className="card ov-card">
              <h3><MapPin size={16} /> Delivering to</h3>
              <p><strong>{a.name}</strong> · {a.phone}</p>
              <p className="muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} – {a.pincode}</p>
            </div>
            <a className="card ov-help" href={whatsappLink(`Hi, I have a question about my order #${order.orderNumber}.`)} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> <span><strong>Need help with this order?</strong><small>Chat with our team on WhatsApp</small></span>
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}
