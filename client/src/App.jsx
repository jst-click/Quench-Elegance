import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import ComboDetail from './pages/ComboDetail';
import About from './pages/About';
import OurStory from './pages/OurStory';
import Founder from './pages/Founder';
import Commitment from './pages/Commitment';
import Awards from './pages/Awards';
import Education from './pages/Education';
import Contact from './pages/Contact';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import Account from './pages/Account';
import OrderView from './pages/OrderView';
import NotFound from './pages/NotFound';

// The admin panel is a separate app (admin/). In production FastAPI serves it at /admin;
// in development it runs on its own port (start-admin.bat).
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || (import.meta.env.DEV ? 'http://localhost:5174/admin/' : '/admin/');
function AdminRedirect() {
  useEffect(() => { window.location.replace(ADMIN_URL); }, []);
  return null;
}

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return undefined; }
    // links like /#kits: wait for the section (it may render after data loads), then scroll to it
    let tries = 0;
    const t = setInterval(() => {
      const el = document.getElementById(hash.slice(1));
      if (el || ++tries > 20) { clearInterval(t); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, 100);
    return () => clearInterval(t);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route path="/admin/*" element={<AdminRedirect />} />
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="combo/:slug" element={<ComboDetail />} />
          <Route path="about" element={<About />} />
          <Route path="our-story" element={<OurStory />} />
          <Route path="founder" element={<Founder />} />
          <Route path="our-commitment" element={<Commitment />} />
          <Route path="awards" element={<Awards />} />
          <Route path="hair-education" element={<Education />} />
          <Route path="contact" element={<Contact />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="account" element={<Account />} />
          <Route path="account/orders/:id" element={<OrderView />} />
          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
