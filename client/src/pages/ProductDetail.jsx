import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Leaf, Minus, Plus, ShieldCheck, Truck, MessageCircle } from 'lucide-react';
import { api } from '../api';
import { useCart } from '../context/AppContext';
import { whatsappLink } from '../content';
import { Loader, Price, ProductCard, Reveal } from '../components/ui';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);
  const [showAllIng, setShowAllIng] = useState(false);

  useEffect(() => {
    setProduct(null); setError(''); setQty(1); setActive(0); setShowAllIng(false);
    api.get(`/api/products/${slug}`).then((d) => {
      setProduct(d.product);
      document.title = `${d.product.name} — Quench Elegance`;
    }).catch((e) => setError(e.message));
    api.get('/api/products').then((d) => setRelated(d.products.filter((p) => p.slug !== slug).slice(0, 4))).catch(() => {});
    return () => { document.title = 'Quench Elegance — Luxury Hair Care, Affordable for Everyone'; };
  }, [slug]);

  if (error) return <div className="container section"><div className="empty-state"><h3>Product not found</h3><p>{error}</p><Link className="btn btn-primary" to="/shop">Back to shop</Link></div></div>;
  if (!product) return <Loader />;

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
          <span className="eyebrow">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="pdp-subtitle">{product.subtitle}</p>
          {product.tagline && <p className="pdp-tagline">“{product.tagline}”</p>}
          <Price price={product.price} mrp={product.mrp} large />
          <p className="pdp-tax">MRP inclusive of all taxes{product.size ? ` · ${product.size}` : ''}</p>
          <p className="pdp-desc">{product.shortDescription}</p>

          <div className="pdp-buy">
            <div className="qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity"><Minus size={16} /></button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Increase quantity"><Plus size={16} /></button>
            </div>
            <button className="btn btn-outline" disabled={out} onClick={() => add(product, qty)}>{out ? 'Out of stock' : 'Add to bag'}</button>
            <button className="btn btn-primary" disabled={out} onClick={() => { add(product, qty); navigate('/checkout'); }}>Buy now</button>
          </div>

          <ul className="pdp-assure">
            <li><Truck size={18} /> Cash on delivery available</li>
            <li><ShieldCheck size={18} /> Registered customers checkout securely with mobile OTP</li>
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
