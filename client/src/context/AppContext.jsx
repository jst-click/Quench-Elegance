import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, tokens } from '../api';

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);
  const push = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setItems((l) => [...l, { id, message, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------- Customer auth ---------------- */
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokens.get('customer')) { setReady(true); return; }
    api.get('/api/auth/me').then((d) => setCustomer(d.customer)).catch(() => {}).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const h = (e) => e.detail === 'customer' && setCustomer(null);
    window.addEventListener('qe:logout', h);
    return () => window.removeEventListener('qe:logout', h);
  }, []);

  const login = (token, c) => { tokens.set('customer', token); setCustomer(c); };
  const logout = () => { tokens.set('customer', null); setCustomer(null); };
  const value = useMemo(() => ({ customer, setCustomer, ready, login, logout }), [customer, ready]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ---------------- Cart ---------------- */
// A cart line is a product ({productId}) or a combo kit ({comboId, type: 'combo'}).
export const lineKey = (i) => (i.comboId ? `combo:${i.comboId}` : i.productId);
export const lineHref = (i) => (i.comboId ? `/combo/${i.slug}` : `/product/${i.slug}`);
const CartCtx = createContext(null);
const CART_KEY = 'qe_cart';
const readCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
};
export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const addLine = (line, qty) => {
    const key = lineKey(line);
    setItems((list) => {
      const found = list.find((i) => lineKey(i) === key);
      if (found) return list.map((i) => (lineKey(i) === key ? { ...i, ...line, qty: Math.min(20, i.qty + qty) } : i));
      return [...list, { ...line, qty }];
    });
    setOpen(true);
  };
  const add = (p, qty = 1) => addLine({ productId: p.id, slug: p.slug, name: p.name, subtitle: p.subtitle, image: p.image, price: p.price, mrp: p.mrp, size: p.size }, qty);
  const addCombo = (c, qty = 1) => addLine({
    type: 'combo', comboId: c.id, slug: c.slug, name: c.name, subtitle: c.tagline, image: c.image || c.banner, price: c.price, mrp: c.mrp,
    size: `Kit · ${c.unitCount} item${c.unitCount === 1 ? '' : 's'}`,
  }, qty);
  // key = lineKey(item)
  const setQty = (key, qty) => setItems((l) => (qty <= 0 ? l.filter((i) => lineKey(i) !== key) : l.map((i) => (lineKey(i) === key ? { ...i, qty: Math.min(20, qty) } : i))));
  const remove = (key) => setItems((l) => l.filter((i) => lineKey(i) !== key));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartCtx.Provider value={{ items, add, addCombo, setQty, remove, clear, count, subtotal, open, setOpen }}>
      {children}
    </CartCtx.Provider>
  );
}
export const useCart = () => useContext(CartCtx);
