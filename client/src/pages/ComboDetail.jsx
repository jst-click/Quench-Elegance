import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Leaf, MessageCircle, MessagesSquare, Package, ShieldCheck, Truck } from 'lucide-react';
import { api, inr } from '../api';
import { useAuth } from '../context/AppContext';
import { whatsappLink } from '../content';
import { Loader, Reveal } from '../components/ui';
import ComboCard from '../components/ComboCard';

export default function ComboDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { customer } = useAuth();
  const [combo, setCombo] = useState(null);
  const [others, setOthers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setCombo(null); setError('');
    api.get(`/api/combos/${slug}`).then((d) => {
      setCombo(d.combo);
      document.title = `${d.combo.name} — ${d.combo.tagline} | Quench Elegance`;
    }).catch((e) => setError(e.message));
    api.get('/api/combos').then((d) => setOthers(d.combos.filter((c) => c.slug !== slug))).catch(() => {});
    return () => { document.title = 'Quench Elegance — Luxury Hair Care, Affordable for Everyone'; };
  }, [slug]);

  if (error) {
    return (
      <div className="container section">
        <div className="empty-state"><h3>Combo not found</h3><p>{error}</p><Link className="btn btn-primary" to="/#kits">See all kits</Link></div>
      </div>
    );
  }
  if (!combo) return <Loader />;

  const c = combo;
  const out = c.available <= 0;
  const separate = c.items.reduce((s, i) => s + i.price * i.qty, 0); // what the products cost bought separately today

  // Same buying flow as a product: chat with the team, kit attached
  const buyNow = () => {
    const chat = `/account?tab=chats&combo=${encodeURIComponent(c.slug)}`;
    navigate(customer ? chat : `/login?next=${encodeURIComponent(chat)}`);
  };

  return (
    <>
      <nav className="container breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={14} /><Link to="/#kits">Combo kits</Link><ChevronRight size={14} /><span>{c.name}</span>
      </nav>

      {/* ---------- Hero: poster + buy box ---------- */}
      <section className="container kit-hero">
        <div className="kit-poster">
          <img src={c.banner || c.image} alt={`${c.name} — ${c.tagline}`} />
        </div>

        <div className="kit-buy card">
          <span className="eyebrow">Signature kit · {c.unitCount} pieces</span>
          <h1>{c.name}</h1>
          <p className="kit-tagline">{c.tagline}</p>
          {c.description && <p className="kit-desc">{c.description}</p>}

          <div className="kit-price">
            <div>
              {c.mrp > c.price && <span className="kit-price-mrp">MRP <s>{inr(c.mrp)}</s></span>}
              <span className="kit-price-now">{inr(c.price)}</span>
              <span className="kit-price-note">Offer price · inclusive of all taxes</span>
            </div>
            {c.savings > 0 && (
              <div className="kit-seal">
                <span>You save</span>
                <strong>{inr(c.savings)}</strong>
                <em>{c.savingsPercent}% off</em>
              </div>
            )}
          </div>

          <ul className="kit-contents">
            {c.items.map((i) => (
              <li key={i.productId}>
                <img src={i.image} alt="" />
                <span><strong>{i.name}</strong><small>{[i.size, `× ${i.qty}`].filter(Boolean).join(' ')}</small></span>
              </li>
            ))}
          </ul>

          <div className="kit-actions">
            <button className="btn btn-primary" disabled={out} onClick={buyNow}><MessagesSquare size={17} /> {out ? 'Out of stock' : 'Buy now'}</button>
          </div>
          {!out && <p className="pdp-buy-note">Tap Buy now to chat with our team. They'll confirm your kit, quantity and delivery.</p>}
          {!out && c.available <= 5 && <p className="kit-low">Only {c.available} kit{c.available === 1 ? '' : 's'} left</p>}

          <ul className="pdp-assure">
            <li><Truck size={18} /> Cash on delivery available</li>
            <li><ShieldCheck size={18} /> Registered customers log in securely with mobile OTP</li>
            <li><Leaf size={18} /> Non-medicated, external hair & scalp care</li>
          </ul>
        </div>
      </section>

      {/* ---------- What's inside ---------- */}
      <section className="section section-tight">
        <div className="container">
          <div className="kit-head">
            <span className="eyebrow center">What's inside the {c.name} kit</span>
            <h2>{c.items.length} formulations, {c.unitCount} pieces</h2>
          </div>
          <div className="kit-items">
            {c.items.map((i, n) => (
              <Reveal key={i.productId} delay={n * 80}>
                <article className="kit-item">
                  <Link to={`/product/${i.slug}`} className="kit-item-img" aria-label={i.name}>
                    {i.image ? <img src={i.image} alt="" /> : <Package size={28} />}
                    <span className="kit-item-qty">× {i.qty}</span>
                  </Link>
                  <div className="kit-item-body">
                    <span className="kit-item-cat">{i.category}{i.size ? ` · ${i.size}` : ''}</span>
                    <h3><Link to={`/product/${i.slug}`}>{i.name}</Link></h3>
                    {i.subtitle && <p className="kit-item-sub">{i.subtitle}</p>}
                    {i.shortDescription && <p className="kit-item-desc">{i.shortDescription}</p>}
                    {i.benefits?.length > 0 && (
                      <ul className="kit-item-benefits">
                        {i.benefits.map((b) => <li key={b}><Check size={13} strokeWidth={3} />{b}</li>)}
                      </ul>
                    )}
                    <Link to={`/product/${i.slug}`} className="kit-item-price">{inr(i.mrp)} each · View full details <ChevronRight size={13} /></Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          {separate > c.price && (
            <div className="kit-value">
              <span>Bought separately today <s>{inr(separate)}</s></span>
              <span className="kit-value-arrow">→</span>
              <span>As the {c.name} kit <strong>{inr(c.price)}</strong></span>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Ritual: step-by-step how to use ---------- */}
      {(c.steps?.length > 0 || c.highlights?.length > 0) && (
        <section className="section dark-section kit-ritual">
          <div className="container">
            {c.steps?.length > 0 && (
              <>
                <div className="kit-head kit-head-light">
                  <span className="eyebrow center light">How to use · {c.steps.length} steps</span>
                  <h2>{c.ritualTitle}</h2>
                </div>
                <ol className="ritual-timeline">
                  {c.steps.map((s, n) => (
                    <Reveal as="li" key={n} delay={n * 100} className="ritual-step">
                      <div className="ritual-marker" aria-hidden="true"><span>Step</span><strong>{n + 1}</strong></div>
                      <div className="ritual-card">
                        {s.product && (
                          <Link to={`/product/${s.product.slug}`} className="ritual-img" aria-label={s.product.name}>
                            {s.product.image ? <img src={s.product.image} alt="" /> : <Package size={26} />}
                          </Link>
                        )}
                        <div className="ritual-body">
                          <span className="ritual-step-label">Step {n + 1}</span>
                          <h3>{s.title}</h3>
                          {s.text && <p className="ritual-with">{s.text}</p>}
                          {s.description && <p className="ritual-desc">{s.description}</p>}
                          {s.product && (
                            <Link to={`/product/${s.product.slug}`} className="ritual-link">
                              About {s.product.name}{s.product.size ? ` (${s.product.size})` : ''} <ChevronRight size={14} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </ol>
                <p className="ritual-note">Follow the directions on each pack. For external use only — patch test before first use.</p>
              </>
            )}

            {c.highlights?.length > 0 && (
              <div className="kit-experience">
                <div className="kit-head kit-head-light">
                  <span className="eyebrow center light">Why this kit</span>
                  <h2>{c.experienceTitle}</h2>
                </div>
                <ul>
                  {c.highlights.map((h) => <li key={h}><span><Check size={15} strokeWidth={3} /></span>{h}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- Closing line ---------- */}
      {c.closing && (
        <section className="section-tight">
          <div className="container">
            <div className="kit-closing">
              <Leaf size={20} /><p>{c.closing}</p><Leaf size={20} className="flip" />
            </div>
            <p className="center-text">
              <a className="pdp-whatsapp" href={whatsappLink(`Hi, I'd like to know more about the ${c.name} kit.`)} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> Questions? Ask our hair-care team on WhatsApp
              </a>
            </p>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="kit-head"><span className="eyebrow center">More rituals</span><h2>Other signature kits</h2></div>
            <div className="combo-grid">
              {others.map((o, n) => <Reveal key={o.id} delay={n * 80}><ComboCard combo={o} /></Reveal>)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
