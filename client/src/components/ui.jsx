import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { inr } from '../api';
import { useCart } from '../context/AppContext';

/** Fades children in when they scroll into view. */
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${inView ? 'in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

export function PageHero({ eyebrow, title, subtitle, image, children }) {
  return (
    <section className="page-hero">
      <div className="page-hero-bg" aria-hidden="true" />
      <div className="container page-hero-inner">
        <div className="page-hero-text">
          {eyebrow && <span className="eyebrow light">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p className="page-hero-sub">{subtitle}</p>}
          {children}
        </div>
        {image && (
          <div className="page-hero-img">
            <img src={image} alt="" />
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, text, center = false, light = false }) {
  return (
    <div className={`section-head ${center ? 'center' : ''} ${light ? 'light' : ''}`}>
      {eyebrow && <span className={`eyebrow ${center ? 'center' : ''}`}>{eyebrow}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export function Price({ price, mrp, large = false }) {
  const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <div className={`price ${large ? 'price-lg' : ''}`}>
      <span className="price-now">{inr(price)}</span>
      {off > 0 && (
        <>
          <span className="price-mrp">MRP {inr(mrp)}</span>
          <span className="price-off">{off}% off</span>
        </>
      )}
    </div>
  );
}

export function ProductCard({ product }) {
  const { add } = useCart();
  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`} className="product-card-media">
        {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div className="img-fallback">QE</div>}
        {product.highlight && <span className="product-card-chip">{product.highlight}</span>}
      </Link>
      <div className="product-card-body">
        <span className="product-card-cat">{product.category}{product.size ? ` · ${product.size}` : ''}</span>
        <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
        <p className="product-card-sub">{product.subtitle}</p>
        <div className="product-card-foot">
          <Price price={product.price} mrp={product.mrp} />
          <button
            className="icon-btn icon-btn-dark"
            onClick={() => add(product)}
            disabled={product.stock <= 0}
            aria-label={`Add ${product.name} to bag`}
            title={product.stock <= 0 ? 'Out of stock' : 'Add to bag'}
          >
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function Loader() {
  return <div className="page-loader"><div className="spinner" /></div>;
}
