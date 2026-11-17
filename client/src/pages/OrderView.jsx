import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, fmtDate, inr } from '../api';
import { useAuth } from '../context/AppContext';
import { Loader } from '../components/ui';

const FLOW = ['Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];

export default function OrderView() {
  const { id } = useParams();
  const { customer, ready } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) api.get(`/api/orders/${id}`).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [id, customer]);

  if (!ready) return <Loader />;
  if (!customer) return <Navigate to={`/login?next=/account/orders/${id}`} replace />;
  if (error) return <div className="container section"><div className="alert alert-error">{error}</div></div>;
  if (!order) return <Loader />;

  const step = FLOW.indexOf(order.status);
  const a = order.address;

  return (
    <section className="section">
      <div className="container">
        <Link to="/account" className="back-link"><ArrowLeft size={16} /> All orders</Link>
        <div className="order-head">
          <div>
            <h1 className="page-title">Order #{order.orderNumber}</h1>
            <p className="muted">Placed on {fmtDate(order.createdAt, true)}</p>
          </div>
          <span className={`status status-${order.status}`}>{order.status}</span>
        </div>

        {order.status !== 'Cancelled' && (
          <div className="tracker card">
            {FLOW.map((s, i) => (
              <div key={s} className={`tracker-step ${i <= step ? 'done' : ''}`}>
                <span className="tracker-dot" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}

        <div className="cart-layout">
          <div className="card cart-lines">
            {order.items.map((i) => (
              <div key={i.productId} className="cart-line">
                <Link to={`/product/${i.slug}`} className="cart-line-img"><img src={i.image} alt="" /></Link>
                <div className="cart-line-info"><span className="cart-line-name">{i.name}</span><span className="muted">{i.size} · Qty {i.qty}</span></div>
                <strong className="cart-line-total">{inr(i.lineTotal)}</strong>
              </div>
            ))}
          </div>
          <aside className="summary card">
            <h3>Summary</h3>
            <div className="summary-row"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
            <div className="summary-row"><span>Shipping</span><span>{order.shipping ? inr(order.shipping) : 'Free'}</span></div>
            <div className="summary-row total"><span>Total</span><strong>{inr(order.total)}</strong></div>
            <div className="summary-row"><span>Payment</span><span>{order.paymentMethod} · {order.paymentStatus}</span></div>
            {order.trackingNumber && <div className="summary-row"><span>Tracking</span><span>{order.trackingNumber}</span></div>}
            <h4>Delivering to</h4>
            <p className="muted">{a.name} · {a.phone}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} – {a.pincode}</p>
            <h4>History</h4>
            <ul className="history">
              {[...order.history].reverse().map((h, i) => <li key={i}><strong>{h.status}</strong> <span className="muted">{fmtDate(h.at, true)}</span>{h.note ? <p>{h.note}</p> : null}</li>)}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}
