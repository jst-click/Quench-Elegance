import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, MapPin, MessageCircle, Package, Trash2, User } from 'lucide-react';
import { api, fmtDate, inr } from '../api';
import { useAuth, useToast } from '../context/AppContext';
import { Loader } from '../components/ui';
import CustomerChat from '../components/Chat';
import { MiniTracker } from './OrderView';
import '../styles/orders.css';

const TABS = ['orders', 'chats', 'profile', 'addresses'];

export default function Account() {
  const { customer, setCustomer, ready, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'orders';
  const productSlug = params.get('product') || '';
  const comboSlug = params.get('combo') || '';
  const [draftProduct, setDraftProduct] = useState(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [orders, setOrders] = useState(null);
  const [orderFilter, setOrderFilter] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);

  const setTab = (t) => setParams(t === 'orders' ? {} : { tab: t });
  const clearDraft = () => { setDraftProduct(null); setParams({ tab: 'chats' }, { replace: true }); };

  // "Buy now" on a product page lands here with ?tab=chats&product=<slug> (or &combo=<slug> for a kit)
  useEffect(() => {
    if (comboSlug) {
      api.get(`/api/combos/${comboSlug}`).then((d) => {
        const c = d.combo;
        setDraftProduct({
          type: 'combo', id: c.id, slug: c.slug, name: c.name, image: c.image || c.banner, price: c.price, mrp: c.mrp,
          category: 'Combo kit', size: `Kit · ${c.unitCount} items`, inStock: c.available > 0,
        });
      }).catch(() => setDraftProduct(null));
      return;
    }
    if (!productSlug) { setDraftProduct(null); return; }
    api.get(`/api/products/${productSlug}`).then((d) => setDraftProduct(d.product)).catch(() => setDraftProduct(null));
  }, [productSlug, comboSlug]);

  useEffect(() => {
    if (!customer || tab === 'chats') { setChatUnread(0); return; }
    api.get('/api/chat/unread').then((d) => setChatUnread(d.unread)).catch(() => {});
  }, [customer, tab]);

  useEffect(() => {
    if (!customer) return;
    setProfile({ name: customer.name, email: customer.email || '' });
    api.get('/api/orders').then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  }, [customer]);

  if (!ready) return <Loader />;
  if (!customer) return <Navigate to={`/login?next=${encodeURIComponent(`/account${params.toString() ? `?${params}` : ''}`)}`} replace />;

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await api.put('/api/auth/me', profile);
      setCustomer(d.customer);
      toast('Profile updated');
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  };

  const removeAddress = async (id) => {
    try {
      const d = await api.del(`/api/auth/addresses/${id}`);
      setCustomer({ ...customer, addresses: d.addresses });
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <section className="section">
      <div className={`container account ${tab === 'chats' ? 'chat-mode' : ''}`}>
        <aside className="account-side card">
          <div className="account-avatar">{customer.name.charAt(0).toUpperCase()}</div>
          <h3>{customer.name}</h3>
          <p className="muted">+91 {customer.phone}</p>
          <span className="badge badge-gold">User ID · {customer.customerCode}</span>
          <nav>
            <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><Package size={18} /> My orders</button>
            <button className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')}>
              <MessageCircle size={18} /> Chats {chatUnread > 0 && <span className="nav-count">{chatUnread}</span>}
            </button>
            <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><User size={18} /> Profile</button>
            <button className={tab === 'addresses' ? 'active' : ''} onClick={() => setTab('addresses')}><MapPin size={18} /> Addresses</button>
            <button onClick={() => { logout(); toast('Logged out'); navigate('/'); }}><LogOut size={18} /> Log out</button>
          </nav>
        </aside>

        <div className="account-main">
          {tab === 'orders' && (
            <>
              <h1 className="page-title">My orders</h1>
              {!orders ? <Loader /> : orders.length === 0 ? (
                <div className="card empty-state"><Package size={40} strokeWidth={1.2} /><h3>No orders yet</h3><Link to="/shop" className="btn btn-primary">Start shopping</Link></div>
              ) : (
                <>
                  <div className="order-filters" role="tablist" aria-label="Filter orders">
                    {[['', 'All'], ['active', 'In progress'], ['Delivered', 'Delivered'], ['Cancelled', 'Cancelled']].map(([k, label]) => {
                      const n = orders.filter((o) => !k || (k === 'active' ? !['Delivered', 'Cancelled'].includes(o.status) : o.status === k)).length;
                      return <button key={k} className={`chip ${orderFilter === k ? 'active' : ''}`} onClick={() => setOrderFilter(k)}>{label} · {n}</button>;
                    })}
                  </div>
                  <div className="order-list">
                    {orders
                      .filter((o) => !orderFilter || (orderFilter === 'active' ? !['Delivered', 'Cancelled'].includes(o.status) : o.status === orderFilter))
                      .map((o) => (
                        <Link to={`/account/orders/${o.id}`} key={o.id} className="oc card">
                          <div className="oc-head">
                            <div>
                              <strong>#{o.orderNumber}</strong>
                              <span className="muted"> · {fmtDate(o.createdAt)}</span>
                              {o.source === 'admin' && <span className="oc-team">Placed by our team</span>}
                            </div>
                            <span className={`status status-${o.status}`}>{o.status}</span>
                          </div>
                          <div className="oc-body">
                            <div className="oc-items">
                              {o.items.slice(0, 4).map((i) => <img key={i.comboId || i.productId} src={i.image} alt={i.name} title={i.name} />)}
                              <span className="muted small">{o.items.reduce((s2, i) => s2 + i.qty, 0)} item(s){o.trackingNumber ? ` · AWB ${o.trackingNumber}` : ''}</span>
                            </div>
                            <div className="oc-total"><strong>{inr(o.total)}</strong><span>Track order →</span></div>
                            <MiniTracker status={o.status} />
                          </div>
                        </Link>
                      ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'chats' && (
            <>
              <h1 className="page-title">Chats</h1>
              <CustomerChat
                draftProduct={draftProduct}
                onDraftSent={() => { clearDraft(); toast('Enquiry sent. Our team will reply here shortly.'); }}
                onDraftDismiss={clearDraft}
              />
            </>
          )}

          {tab === 'profile' && (
            <>
              <h1 className="page-title">Profile</h1>
              <form className="card form-card" onSubmit={saveProfile}>
                <div className="form-grid">
                  <div className="field"><label>Name</label><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></div>
                  <div className="field"><label>Email</label><input type="email" className="input" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
                  <div className="field"><label>Mobile (login)</label><input className="input" value={`+91 ${customer.phone}`} disabled /></div>
                  <div className="field"><label>User ID</label><input className="input" value={customer.customerCode} disabled /></div>
                </div>
                <p className="muted small">To change your registered mobile number, please contact Quench Elegance.</p>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              </form>
            </>
          )}

          {tab === 'addresses' && (
            <>
              <h1 className="page-title">Saved addresses</h1>
              {(customer.addresses || []).length === 0 ? (
                <div className="card empty-state"><MapPin size={36} strokeWidth={1.2} /><p>Addresses you save at checkout appear here.</p></div>
              ) : (
                <div className="addr-grid">
                  {customer.addresses.map((a) => (
                    <div key={a.id} className="card addr-card">
                      <strong>{a.name}</strong>
                      <span>{a.phone}</span>
                      <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} – {a.pincode}</p>
                      <button className="icon-btn sm" onClick={() => removeAddress(a.id)} aria-label="Delete address"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
