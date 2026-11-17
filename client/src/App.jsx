import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
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
import Account from './pages/Account';
import OrderView from './pages/OrderView';
import NotFound from './pages/NotFound';
import AdminApp from './admin/AdminApp';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<ProductDetail />} />
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
          <Route path="account" element={<Account />} />
          <Route path="account/orders/:id" element={<OrderView />} />
          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
