import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Banknote, CheckCircle2, MapPin } from 'lucide-react';
import { api, inr } from '../api';
import { lineKey, useAuth, useCart, useToast } from '../context/AppContext';
import { Loader } from '../components/ui';

const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

export default function Checkout() {
  const { customer, ready } = useAuth();
  const { items, subtotal, clear } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [cfg, setCfg] = useState({ shippingFlat: 0, freeShippingAbove: 0 });
  const [selected, setSelected] = useState('new');
  const [addr, setAddr] = useState({ name: '', phone: '', line1: '', line2: '', city: '', state: 'Karnataka', pincode: '' });
  const [save, setSave] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null);

  useEffect(() => { api.get('/api/store-config', { auth: null }).then(setCfg).catch(() => {}); }, []);
  useEffect(() => {
    if (!customer) return;
    const saved = customer.addresses || [];
    if (saved.length) setSelected(saved[saved.length - 1].id);
    setAddr((a) => ({ ...a, name: a.name || customer.name, phone: a.phone || customer.phone }));
  }, [customer]);

  if (!ready) return <Loader />;
  if (!customer) return <Navigate to="/login?next=/checkout" replace />;

  if (placed) {
    return (
      <section className="section">
        <div className="container narrow empty-state success-state">
          <CheckCircle2 size={56} strokeWidth={1.3} />
          <span className="eyebrow center">Thank you, {customer.name.split(' ')[0]}</span>
          <h1>Your order is placed</h1>
          <p>Order <strong>#{placed.orderNumber}</strong> · {inr(placed.total)} · Cash on Delivery</p>
          <p className="muted">Our team will confirm your order shortly. You can track its status from your account.</p>
          <div className="hero-ctas center">
            <Link to={`/account/orders/${placed.id}`} className="btn btn-primary">View order</Link>
            <Link to="/shop" className="btn btn-outline">Continue shopping</Link>
          </div>
        </div>
      </section>
    );
  }

  if (!items.length) return <Navigate to="/cart" replace />;

  const shipping = !cfg.shippingFlat ? 0 : cfg.freeShippingAbove && subtotal >= cfg.freeShippingAbove ? 0 : cfg.shippingFlat;
  const saved = customer.addresses || [];
  const set = (k) => (e) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  const place = async () => {
    setError('');
    const address = selected === 'new' ? addr : saved.find((a) => a.id === selected);
    if (!address) { setError('Please choose a delivery address.'); return; }
    setPlacing(true);
    try {
      const d = await api.post('/api/orders', {
        items: items.map((i) => (i.comboId ? { comboId: i.comboId, qty: i.qty } : { productId: i.productId, qty: i.qty })),
        address,
        notes,
        saveAddress: selected === 'new' && save,
      });
      clear();
      setPlaced(d.order);
      toast('Order placed successfully');
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title">Checkout</h1>
        <div className="cart-layout">
          <div className="checkout-main">
            <div className="card checkout-block">
              <div className="checkout-step"><span>1</span><h3>Account</h3></div>
              <p>Logged in as <strong>{customer.name}</strong> · +91 {customer.phone} · User ID <strong>{customer.customerCode}</strong></p>
            </div>

            <div className="card checkout-block">
              <div className="checkout-step"><span>2</span><h3>Delivery address</h3></div>
              {saved.length > 0 && (
                <div className="addr-options">
                  {saved.map((a) => (
                    <label key={a.id} className={`addr-option ${selected === a.id ? 'active' : ''}`}>
                      <input type="radio" name="addr" checked={selected === a.id} onChange={() => setSelected(a.id)} />
                      <MapPin size={18} />
                      <div><strong>{a.name}</strong> · {a.phone}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}</div>
                    </label>
                  ))}
                  <label className={`addr-option ${selected === 'new' ? 'active' : ''}`}>
                    <input type="radio" name="addr" checked={selected === 'new'} onChange={() => setSelected('new')} />
                    <span>+ Deliver to a new address</span>
                  </label>
                </div>
              )}
              {selected === 'new' && (
                <div className="form-grid">
                  <div className="field"><label>Full name *</label><input className="input" value={addr.name} onChange={set('name')} /></div>
                  <div className="field"><label>Mobile *</label><input className="input" inputMode="tel" value={addr.phone} onChange={set('phone')} /></div>
                  <div className="field span-2"><label>House / flat, street *</label><input className="input" value={addr.line1} onChange={set('line1')} /></div>
                  <div className="field span-2"><label>Area, landmark</label><input className="input" value={addr.line2} onChange={set('line2')} /></div>
                  <div className="field"><label>City *</label><input className="input" value={addr.city} onChange={set('city')} /></div>
                  <div className="field"><label>PIN code *</label><input className="input" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={set('pincode')} /></div>
                  <div className="field span-2">
                    <label>State *</label>
                    <select className="select" value={addr.state} onChange={set('state')}>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
                  </div>
                  <label className="check span-2"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save this address for next time</label>
                </div>
              )}
            </div>

            <div className="card checkout-block">
              <div className="checkout-step"><span>3</span><h3>Payment</h3></div>
              <label className="addr-option active">
                <input type="radio" checked readOnly />
                <Banknote size={18} />
                <div><strong>Cash on Delivery</strong><br /><span className="muted">Pay in cash or UPI when your order arrives.</span></div>
              </label>
              <div className="field" style={{ marginTop: 16 }}>
                <label htmlFor="notes">Order notes (optional)</label>
                <textarea id="notes" className="textarea" style={{ minHeight: 70 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, preferred time, etc." />
              </div>
            </div>
          </div>

          <aside className="summary card">
            <h3>Order summary</h3>
            <div className="summary-items">
              {items.map((i) => (
                <div key={lineKey(i)} className="summary-item">
                  <div className="summary-item-img"><img src={i.image} alt="" /><span>{i.qty}</span></div>
                  <div className="summary-item-name">{i.name}<small>{i.size}</small></div>
                  <span>{inr(i.price * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="summary-row"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="summary-row"><span>Shipping</span><span>{shipping ? inr(shipping) : 'Free'}</span></div>
            <div className="summary-row total"><span>Total</span><strong>{inr(subtotal + shipping)}</strong></div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary btn-block" onClick={place} disabled={placing}>{placing ? 'Placing order…' : `Place order · ${inr(subtotal + shipping)}`}</button>
            <p className="muted small center-text">By placing your order you agree to our terms. Results from cosmetic products vary by individual.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
