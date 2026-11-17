import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Instagram, Mail, MapPin, Menu, Minus, Phone, Plus, ShoppingBag, Trash2, User, X } from 'lucide-react';
import { useAuth, useCart } from '../context/AppContext';
import { BRAND, whatsappLink } from '../content';
import { inr } from '../api';

const ABOUT_LINKS = [
  { to: '/about', label: 'About Us' },
  { to: '/our-story', label: 'Our Story' },
  { to: '/founder', label: "Founder's Message" },
  { to: '/our-commitment', label: 'Our Commitment' },
];

function Header() {
  const { count, setOpen } = useCart();
  const { customer } = useAuth();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menu ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menu]);

  return (
    <>
      <div className="announce">
        <div className="container announce-inner">
          <span>Award-winning hair care from Bengaluru</span>
          <span className="announce-dot" />
          <span>12 months of complimentary hair-care guidance</span>
          <span className="announce-dot hide-sm" />
          <span className="hide-sm">Cash on delivery across India</span>
        </div>
      </div>
      <header className={`site-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container header-inner">
          <button className="icon-btn menu-toggle" onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={22} /></button>
          <Link to="/" className="logo" aria-label="Quench Elegance home">
            <img src="/images/brand/logo-brown.png" alt="Quench Elegance" />
          </Link>
          <nav className="main-nav" aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/shop">Shop</NavLink>
            <div className="nav-drop">
              <button className={ABOUT_LINKS.some((l) => pathname === l.to) ? 'active' : ''}>About <ChevronDown size={14} /></button>
              <div className="nav-drop-menu">
                {ABOUT_LINKS.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
              </div>
            </div>
            <NavLink to="/awards">Awards</NavLink>
            <NavLink to="/hair-education">Hair Education</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </nav>
          <div className="header-actions">
            <Link to={customer ? '/account' : '/login'} className="icon-btn" aria-label="Account" title={customer ? customer.name : 'Login'}>
              <User size={20} />
            </Link>
            <button className="icon-btn cart-btn" onClick={() => setOpen(true)} aria-label={`Bag, ${count} items`}>
              <ShoppingBag size={20} />
              {count > 0 && <span className="cart-count">{count}</span>}
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-nav ${menu ? 'open' : ''}`} aria-hidden={!menu}>
        <div className="mobile-nav-backdrop" onClick={() => setMenu(false)} />
        <aside className="mobile-nav-panel">
          <div className="mobile-nav-head">
            <img src="/images/brand/logo-white.png" alt="Quench Elegance" />
            <button className="icon-btn light" onClick={() => setMenu(false)} aria-label="Close menu"><X size={22} /></button>
          </div>
          <nav>
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/shop">Shop All</NavLink>
            {ABOUT_LINKS.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
            <NavLink to="/awards">Awards & Recognition</NavLink>
            <NavLink to="/hair-education">Hair Education</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            <NavLink to={customer ? '/account' : '/login'}>{customer ? 'My Account' : 'Login with OTP'}</NavLink>
          </nav>
          <p className="mobile-nav-foot">{BRAND.tagline}</p>
        </aside>
      </div>
    </>
  );
}

function CartDrawer() {
  const { items, open, setOpen, setQty, remove, subtotal, count } = useCart();
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, setOpen]);

  return (
    <div className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={() => setOpen(false)} />
      <aside className="drawer-panel" role="dialog" aria-label="Shopping bag">
        <div className="drawer-head">
          <h3>Your Bag <span>({count})</span></h3>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>
        </div>
        {items.length === 0 ? (
          <div className="drawer-empty">
            <ShoppingBag size={40} strokeWidth={1.2} />
            <p>Your bag is empty.</p>
            <button className="btn btn-primary" onClick={() => { setOpen(false); navigate('/shop'); }}>Explore the collection</button>
          </div>
        ) : (
          <>
            <div className="drawer-items">
              {items.map((i) => (
                <div className="drawer-item" key={i.productId}>
                  <Link to={`/product/${i.slug}`} onClick={() => setOpen(false)} className="drawer-item-img"><img src={i.image} alt="" /></Link>
                  <div className="drawer-item-info">
                    <Link to={`/product/${i.slug}`} onClick={() => setOpen(false)} className="drawer-item-name">{i.name}</Link>
                    <span className="drawer-item-sub">{i.size || i.subtitle}</span>
                    <div className="qty qty-sm">
                      <button onClick={() => setQty(i.productId, i.qty - 1)} aria-label="Decrease"><Minus size={14} /></button>
                      <span>{i.qty}</span>
                      <button onClick={() => setQty(i.productId, i.qty + 1)} aria-label="Increase"><Plus size={14} /></button>
                    </div>
                  </div>
                  <div className="drawer-item-right">
                    <strong>{inr(i.price * i.qty)}</strong>
                    <button className="icon-btn sm" onClick={() => remove(i.productId)} aria-label="Remove"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-foot">
              <div className="drawer-total"><span>Subtotal</span><strong>{inr(subtotal)}</strong></div>
              <p className="drawer-note">MRP inclusive of all taxes. Shipping calculated at checkout.</p>
              <button className="btn btn-primary btn-block" onClick={() => { setOpen(false); navigate('/checkout'); }}>Checkout</button>
              <button className="btn btn-outline btn-block" onClick={() => { setOpen(false); navigate('/cart'); }}>View bag</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-glow" aria-hidden="true" />
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <img src="/images/brand/logo-white.png" alt="Quench Elegance" />
            <p className="footer-tag">Luxury Hair Care.<br />Affordable for Everyone.</p>
            <p className="footer-blurb">Botanical wisdom, active-infused formulations and honest hair-care guidance — founded in Bengaluru in 2024.</p>
            <div className="footer-social">
              <a href={BRAND.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
              <a href={`mailto:${BRAND.email}`} aria-label="Email"><Mail size={18} /></a>
              <a href={`tel:+${BRAND.phoneRaw}`} aria-label="Phone"><Phone size={18} /></a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Shop</h4>
            <Link to="/shop">All Products</Link>
            <Link to="/shop?category=Hair%20Oil">Hair Oil</Link>
            <Link to="/shop?category=Hair%20Serum">Hair Serums</Link>
            <Link to="/shop?category=Scalp%20Care">Scalp Care</Link>
            <Link to="/shop?category=Shampoo">Shampoo</Link>
            <Link to="/shop?category=Conditioner">Conditioner</Link>
          </div>
          <div className="footer-col">
            <h4>Quench Elegance</h4>
            <Link to="/about">About Us</Link>
            <Link to="/our-story">Our Story</Link>
            <Link to="/founder">Founder's Message</Link>
            <Link to="/our-commitment">Our Commitment</Link>
            <Link to="/awards">Awards</Link>
            <Link to="/hair-education">Hair Education</Link>
          </div>
          <div className="footer-col footer-contact">
            <h4>Get in touch</h4>
            <a href={`tel:+${BRAND.phoneRaw}`}><Phone size={15} /> {BRAND.phone}</a>
            <a href={`mailto:${BRAND.email}`}><Mail size={15} /> {BRAND.email}</a>
            <a href={BRAND.instagram} target="_blank" rel="noreferrer"><Instagram size={15} /> {BRAND.instagramHandle}</a>
            <span><MapPin size={15} /> {BRAND.address}</span>
            <a className="btn btn-gold btn-sm" href={whatsappLink()} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Quench Elegance. All rights reserved.</span>
          <span className="footer-sig">{BRAND.signature}</span>
        </div>
        <p className="footer-disclaimer">
          Quench Elegance products are cosmetic, non-medicated external hair and scalp care. Individual results vary and are not guaranteed.
          Content on this website is for education and awareness and is not a substitute for professional medical consultation.
        </p>
      </div>
    </footer>
  );
}

export default function SiteLayout() {
  return (
    <div className="site">
      <Header />
      <main><Outlet /></main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
