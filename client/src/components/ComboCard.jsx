import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { inr } from '../api';
import { useCart } from '../context/AppContext';

/** Combo kit card: poster, name, contents, price with savings. */
export default function ComboCard({ combo: c }) {
  const { addCombo } = useCart();
  const soldOut = c.available <= 0;
  return (
    <article className="combo-card">
      <Link to={`/combo/${c.slug}`} className="combo-card-media">
        <img src={c.image || c.banner} alt={`${c.name} — ${c.tagline}`} loading="lazy" />
      </Link>
      <div className="combo-card-body">
        <div className="combo-card-top">
          <span className="combo-card-eyebrow">{c.unitCount}-piece kit</span>
          {c.savingsPercent > 0 && <span className="combo-save">Save {c.savingsPercent}%</span>}
        </div>
        <h3><Link to={`/combo/${c.slug}`}>{c.name}</Link></h3>
        <p className="combo-card-tag">{c.tagline}</p>
        <ul className="combo-card-items">
          {c.items.map((i) => (
            <li key={i.productId}>
              <img src={i.image} alt="" />
              <span>{i.name}<em>× {i.qty}</em></span>
            </li>
          ))}
        </ul>
        <div className="combo-card-foot">
          <div className="combo-price">
            {c.mrp > c.price && <span className="combo-price-mrp">MRP {inr(c.mrp)}</span>}
            <strong>{inr(c.price)}</strong>
          </div>
          <div className="combo-card-actions">
            <button className="icon-btn icon-btn-dark" onClick={() => addCombo(c)} disabled={soldOut} aria-label={`Add ${c.name} kit to bag`} title={soldOut ? 'Out of stock' : 'Add to bag'}>
              <ShoppingBag size={18} />
            </button>
            <Link to={`/combo/${c.slug}`} className="btn btn-primary btn-sm">View kit <ArrowRight size={14} /></Link>
          </div>
        </div>
      </div>
    </article>
  );
}
