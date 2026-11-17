import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { inr } from '../api';
import { useCart } from '../context/AppContext';

export default function Cart() {
  const { items, setQty, remove, subtotal } = useCart();
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <section className="section">
        <div className="container empty-state">
          <ShoppingBag size={48} strokeWidth={1.1} />
          <h1>Your bag is empty</h1>
          <p>Discover rituals for healthier-looking hair and a comfortable scalp.</p>
          <Link to="/shop" className="btn btn-primary">Shop the collection</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title">Your Bag</h1>
        <div className="cart-layout">
          <div className="cart-lines card">
            {items.map((i) => (
              <div key={i.productId} className="cart-line">
                <Link to={`/product/${i.slug}`} className="cart-line-img"><img src={i.image} alt="" /></Link>
                <div className="cart-line-info">
                  <Link to={`/product/${i.slug}`} className="cart-line-name">{i.name}</Link>
                  <span className="muted">{i.subtitle}{i.size ? ` · ${i.size}` : ''}</span>
                  <span className="cart-line-unit">{inr(i.price)} each</span>
                </div>
                <div className="qty">
                  <button onClick={() => setQty(i.productId, i.qty - 1)} aria-label="Decrease"><Minus size={16} /></button>
                  <span>{i.qty}</span>
                  <button onClick={() => setQty(i.productId, i.qty + 1)} aria-label="Increase"><Plus size={16} /></button>
                </div>
                <strong className="cart-line-total">{inr(i.qty * i.price)}</strong>
                <button className="icon-btn sm" onClick={() => remove(i.productId)} aria-label="Remove"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <aside className="summary card">
            <h3>Order summary</h3>
            <div className="summary-row"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="summary-row"><span>Shipping</span><span>Calculated at checkout</span></div>
            <div className="summary-row total"><span>Total</span><strong>{inr(subtotal)}</strong></div>
            <p className="muted small">MRP inclusive of all taxes.</p>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/checkout')}>Proceed to checkout</button>
            <Link to="/shop" className="btn-link center-text">Continue shopping</Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
