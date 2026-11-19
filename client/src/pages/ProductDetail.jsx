import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Leaf, ShieldCheck, Truck, MessageCircle, MessagesSquare } from 'lucide-react';
import { api, inr } from '../api';
import { useAuth } from '../context/AppContext';
import { whatsappLink } from '../content';
import { Loader, Price, ProductCard, Reveal } from '../components/ui';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { customer } = useAuth();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [kits, setKits] = useState([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [showAllIng, setShowAllIng] = useState(false);

  useEffect(() => {
    setProduct(null); setError(''); setActive(0); setShowAllIng(false);
    api.get(`/api/products/${slug}`).then((d) => {
      setProduct(d.product);
      document.title = `${d.product.name} — Quench Elegance`;
    }).catch((e) => setError(e.message));
    api.get('/api/products').then((d) => setRelated(d.products.filter((p) => p.slug !== slug).slice(0, 4))).catch(() => {});
    // combo kits that include this product
    api.get('/api/combos').then((d) => setKits(d.combos.filter((c) => c.items.some((i) => i.slug === slug)))).catch(() => setKits([]));
    return () => { document.title = 'Quench Elegance — Luxury Hair Care, Affordable for Everyone'; };
  }, [slug]);

  if (error) return <div className="container section"><div className="empty-state"><h3>Product not found</h3><p>{error}</p><Link className="btn btn-primary" to="/shop">Back to shop</Link></div></div>;
  if (!product) return <Loader />;

  // Buying happens through a chat with our team: logged-in customers go straight to the chat with
  // this product attached; everyone else logs in first and is brought back to the same chat.
  const buyNow = () => {
    const chat = `/account?tab=chats&product=${encodeURIComponent(product.slug)}`;
    navigate(customer ? chat : `/login?next=${encodeURIComponent(chat)}`);
  };

  const images = [product.image, ...(product.gallery || [])].filter(Boolean);
  const out = product.stock <= 0;
  const ingredients = product.ingredients || [];
  const visibleIng = showAllIng ? ingredients : ingredients.slice(0, 18);

  return (
    <>
      <div className="container breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={14} /><Link to="/shop">Shop</Link><ChevronRight size={14} /><span>{product.name}</span>
      </div>

      <section className="container pdp">
        <div className="pdp-gallery">
          <div className="pdp-main-img">
            {images[active] ? <img src={images[active]} alt={product.name} /> : <div className="img-fallback">QE</div>}
            {product.highlight && <span className="product-card-chip">{product.highlight}</span>}
          </div>
          {images.length > 1 && (
            <div className="pdp-thumbs">
              {images.map((src, i) => (
                <button key={src} className={i === active ? 'active' : ''} onClick={() => setActive(i)} aria-label={`Image ${i + 1}`}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </div>

        <div className="pdp-info">
          <span className="eyebrow">{[product.category, product.subcategory].filter(Boolean).join(' · ')}</span>
          <h1>{product.name}</h1>
          <p className="pdp-subtitle">{product.subtitle}</p>
          {product.tagline && <p className="pdp-tagline">“{product.tagline}”</p>}
          <Price price={product.price} mrp={product.mrp} large />
          <p className="pdp-tax">MRP inclusive of all taxes{product.size ? ` · ${product.size}` : ''}</p>
          <p className="pdp-desc">{product.shortDescription}</p>

          <div className="pdp-buy">
            <button className="btn btn-primary" disabled={out} onClick={buyNow}>
              <MessagesSquare size={17} /> {out ? 'Out of stock' : 'Buy now'}
            </button>
          </div>
          {!out && <p className="pdp-buy-note">Tap Buy now to chat with our team. They'll confirm your order, quantity and delivery.</p>}

          {kits.length > 0 && (
            <div className="pdp-kits">
              <p className="pdp-kits-title">Save with a kit</p>
              {kits.map((k) => (
                <Link key={k.id} to={`/combo/${k.slug}`} className="pdp-kit">
                  <img src={k.image || k.banner} alt="" />
                  <span><strong>{k.name}</strong>{k.tagline}</span>
                  <b>{inr(k.price)}{k.savingsPercent > 0 ? ` · ${k.savingsPercent}% off` : ''}</b>
                </Link>
              ))}
            </div>
          )}

          <ul className="pdp-assure">
            <li><Truck size={18} /> Cash on delivery available</li>
            <li><ShieldCheck size={18} /> Registered customers log in securely with mobile OTP</li>
            <li><Leaf size={18} /> Non-medicated, external hair & scalp care</li>
          </ul>

          {product.tags?.length > 0 && (
            <div className="pdp-tags">{product.tags.map((t) => <span key={t} className="badge badge-gold">{t}</span>)}</div>
          )}

          <a className="pdp-whatsapp" href={whatsappLink(`Hi, I'd like to know more about ${product.name}.`)} target="_blank" rel="noreferrer">
            <MessageCircle size={18} /> Questions? Ask our hair-care team on WhatsApp
          </a>
        </div>
      </section>

      {product.intro && (
        <section className="section pdp-intro">
          <div className="container narrow center-text">
            <span className="eyebrow center">The science of care</span>
            <Reveal as="p" className="lead-serif">{product.intro}</Reveal>
          </div>
        </section>
      )}

      {product.benefits?.length > 0 && (
        <section className="section section-tight">
          <div className="container">
            <div className="benefit-grid">
              {product.benefits.map((b, i) => (
                <Reveal key={b.title} className="benefit" delay={(i % 3) * 80}>
                  <span className="benefit-no">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {ingredients.length > 0 && (
        <section className="section section-tight">
          <div className="container ingredients">
            <div>
              <span className="eyebrow">Full ingredient list</span>
              <h2>What's inside</h2>
              <p className="muted">{ingredients.length} ingredients. Patch-test before first use and discontinue if irritation occurs.</p>
            </div>
            <div>
              <div className="ing-list">{visibleIng.map((i) => <span key={i}>{i}</span>)}</div>
              {ingredients.length > 18 && (
                <button className="btn-link" onClick={() => setShowAllIng((v) => !v)}>
                  {showAllIng ? 'Show fewer' : `Show all ${ingredients.length} ingredients`}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {(product.closingTitle || product.signature) && (
        <section className="section section-tight">
          <div className="container">
            <Reveal className="pdp-closing">
              <h2>{product.closingTitle}</h2>
              {product.closingBody && <p>{product.closingBody}</p>}
              {product.signature && <span className="pdp-signature">{product.signature}</span>}
            </Reveal>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <h2 className="related-title">Complete your ritual</h2>
            <div className="product-grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}
