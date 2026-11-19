import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Gift, MapPin, Minus, Package, Plus, Search, ShoppingBag, User, X } from 'lucide-react';
import { api } from '../lib/api';
import { inr } from '../lib/format';
import { Alert, Avatar, Field, PageHeader, PageLoader } from '../components/ui';
import { useToast } from '../components/feedback';

const BLANK_ADDRESS = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

function Section({ n, title, description, children, action, className = '' }) {
  return (
    <section className={`card card-pad ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brown-800 text-sm font-semibold text-gold-soft">{n}</span>
          <div>
            <h2 className="card-title leading-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Search-as-you-type customer picker. */
function CustomerPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setLoading(false); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get(`/customers?q=${encodeURIComponent(q.trim())}&status=active`)
        .then((d) => { setResults(d.customers.slice(0, 20)); setActive(0); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // close when clicking anywhere outside the picker
  useEffect(() => {
    const h = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const choose = (c) => { onChange(c); setOpen(false); setQ(''); };
  const onKey = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brown-800/20 bg-cream/40 p-3">
        <Avatar name={value.name} className="size-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{value.name}</p>
          <p className="truncate text-xs text-muted">{value.customerCode} · +91 {value.phone}{value.email ? ` · ${value.email}` : ''}</p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }

  const showList = open && q.trim();
  return (
    <div className="relative" ref={boxRef}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-silver-500" />
      <input
        className={`input pl-10 ${showList ? '!rounded-b-none !border-brown-700' : ''}`}
        placeholder="Search by name, mobile number or User ID…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={!!showList}
        aria-controls="customer-results"
        autoComplete="off"
        autoFocus
      />
      {showList && (
        <div id="customer-results" role="listbox" className="absolute inset-x-0 top-full z-40 overflow-hidden rounded-b-2xl border border-t-0 border-brown-700 bg-[#fdfcfb] shadow-lift">
          <p className="border-b border-silver-200 bg-silver-50 px-4 py-2 text-[11px] font-medium uppercase tracking-[.16em] text-muted">
            {loading ? 'Searching…' : `${results.length} customer${results.length === 1 ? '' : 's'} found`}
          </p>
          {!loading && results.length === 0 ? (
            <div className="px-4 py-5 text-center text-sm text-muted">
              No active customer matches “{q.trim()}”.
              <Link to="/customers?new=1" className="link ml-1">Add a customer</Link>
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(c)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${i === active ? 'bg-cream/70' : ''}`}
                  >
                    <Avatar name={c.name} className="size-9 text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted">
                        <span className="font-mono text-brown-800">{c.customerCode}</span> · +91 {c.phone}{c.email ? ` · ${c.email}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-silver-100 px-2 py-0.5 text-[11px] text-muted">{c.orders} order{c.orders === 1 ? '' : 's'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-silver-200 px-4 py-1.5 text-[11px] text-muted">↑ ↓ to move · Enter to select · Esc to close</p>
        </div>
      )}
    </div>
  );
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [opts, setOpts] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]); // {key, kind, id, name, image, meta, qty, price, defaultPrice, stockNote}
  const [pick, setPick] = useState('');
  const [addrMode, setAddrMode] = useState('new'); // saved address id | 'new'
  const [addr, setAddr] = useState(BLANK_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);
  const [form, setForm] = useState({ status: 'Confirmed', statusNote: '', paymentMethod: 'Cash on Delivery', paymentStatus: 'Pending', trackingNumber: '', notes: '', adminNotes: '', discount: '', shipping: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/order-options').then(setOpts).catch((e) => setError(e.message)); }, []);
  // "Create order" from a customer's page preselects them
  useEffect(() => {
    const id = params.get('customer');
    if (id) api.get(`/customers/${id}`).then((d) => setCustomer(d.customer)).catch(() => {});
  }, [params]);
  // when the customer changes, default to their first saved address
  useEffect(() => {
    const saved = customer?.addresses || [];
    if (saved.length) { setAddrMode(saved[0].id); } else {
      setAddrMode('new');
      setAddr(customer ? { ...BLANK_ADDRESS, name: customer.name, phone: customer.phone } : BLANK_ADDRESS);
    }
  }, [customer]);

  const catalogue = useMemo(() => {
    if (!opts) return {};
    const map = {};
    opts.products.forEach((p) => { map[`p:${p.id}`] = { kind: 'product', id: p.id, name: p.name, image: p.image, meta: p.size, price: p.price, mrp: p.mrp, stock: p.stock, active: p.active }; });
    opts.combos.forEach((c) => { map[`c:${c.id}`] = { kind: 'combo', id: c.id, name: c.name, image: c.image, meta: c.items.map((i) => `${i.name} ×${i.qty}`).join(', '), price: c.price, mrp: c.mrp, stock: c.available, active: c.active }; });
    return map;
  }, [opts]);

  if (error && !opts) return <Alert>{error}</Alert>;
  if (!opts) return <PageLoader />;

  const addLine = () => {
    const item = catalogue[pick];
    if (!item) return;
    setLines((ls) => (ls.some((l) => l.key === pick)
      ? ls.map((l) => (l.key === pick ? { ...l, qty: l.qty + 1 } : l))
      : [...ls, { key: pick, ...item, qty: 1, defaultPrice: item.price }]));
    setPick('');
  };
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + (Number(l.price) || 0) * l.qty, 0);
  const discount = Math.min(subtotal, Math.max(0, Number(form.discount) || 0));
  const autoShipping = opts.shippingFlat && !(opts.freeShippingAbove && subtotal - discount >= opts.freeShippingAbove) ? opts.shippingFlat : 0;
  const shipping = form.shipping === '' ? autoShipping : Math.max(0, Number(form.shipping) || 0);
  const total = subtotal - discount + shipping;
  const savedAddresses = customer?.addresses || [];
  const chosenAddress = addrMode === 'new' ? addr : savedAddresses.find((a) => a.id === addrMode);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!customer) { setError('Choose a customer.'); return; }
    if (!lines.length) { setError('Add at least one product.'); return; }
    setSaving(true);
    try {
      const d = await api.post('/orders', {
        customerId: customer.id,
        items: lines.map((l) => ({ [l.kind === 'combo' ? 'comboId' : 'productId']: l.id, qty: l.qty, price: Number(l.price) !== l.defaultPrice ? Number(l.price) : null })),
        address: chosenAddress,
        saveAddress: addrMode === 'new' && saveAddress,
        ...form,
        discount,
        shipping: form.shipping === '' ? null : shipping,
      });
      toast(`Order #${d.order.orderNumber} created · Invoice ${d.order.invoiceNumber}`);
      navigate(`/orders/${d.order.id}`);
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <PageHeader
        back={{ to: '/orders', label: 'Orders' }}
        eyebrow="New order"
        title="Create order"
        subtitle="For phone, WhatsApp or in-store sales. The order appears in the customer's account with tracking, and an invoice is created."
      />
      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Section n={1} title="Customer" description="Only registered, active customers can be assigned an order." className="relative z-30">
            <CustomerPicker value={customer} onChange={setCustomer} />
          </Section>

          <Section n={2} title="Products" description="Add products or combo kits. You can change the unit price for this order.">
            <div className="flex gap-2">
              <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Product or kit to add">
                <option value="">Select a product or kit…</option>
                <optgroup label="Products">
                  {opts.products.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}{p.size ? ` (${p.size})` : ''} — {inr(p.price)} · {p.stock} in stock{p.active ? '' : ' · hidden'}</option>)}
                </optgroup>
                {opts.combos.length > 0 && (
                  <optgroup label="Combo kits">
                    {opts.combos.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name} kit — {inr(c.price)} · {c.available} available{c.active ? '' : ' · hidden'}</option>)}
                  </optgroup>
                )}
              </select>
              <button type="button" className="btn-primary shrink-0" onClick={addLine} disabled={!pick}><Plus size={15} /> Add</button>
            </div>

            {lines.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-silver-300 py-10 text-center text-sm text-muted">
                <ShoppingBag size={22} className="mx-auto mb-2 text-bronze" /> No items yet.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-silver-200">
                <table className="table">
                  <thead><tr><th>Item</th><th className="text-center">Qty</th><th className="text-right">Unit price (₹)</th><th className="text-right">Total</th><th /></tr></thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.key}>
                        <td>
                          <div className="flex min-w-56 items-center gap-3">
                            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-silver-100">
                              {l.image ? <img src={l.image} alt="" className="size-full object-cover" /> : (l.kind === 'combo' ? <Gift size={16} /> : <Package size={16} />)}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium">{l.kind === 'combo' && <span className="mr-1.5 rounded-full bg-brown-800 px-1.5 py-px align-middle text-[9px] font-semibold uppercase tracking-wider text-gold-soft">Kit</span>}{l.name}</span>
                              <span className="block max-w-72 truncate text-xs text-muted">{l.meta}</span>
                              {l.qty > l.stock && <span className="block text-xs text-danger">Only {l.stock} available</span>}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="mx-auto flex w-fit items-center rounded-full border border-silver-300 bg-white">
                            <button type="button" className="grid size-8 place-items-center disabled:opacity-30" onClick={() => setLine(l.key, { qty: l.qty - 1 })} disabled={l.qty <= 1} aria-label="Fewer"><Minus size={14} /></button>
                            <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                            <button type="button" className="grid size-8 place-items-center" onClick={() => setLine(l.key, { qty: Math.min(99, l.qty + 1) })} aria-label="More"><Plus size={14} /></button>
                          </div>
                        </td>
                        <td className="text-right">
                          <input type="number" min="0" className="input ml-auto !w-28 !py-1.5 text-right" value={l.price} onChange={(e) => setLine(l.key, { price: e.target.value })} aria-label={`Unit price for ${l.name}`} />
                          {Number(l.price) !== l.defaultPrice && <span className="mt-0.5 block text-[11px] text-warning">List price {inr(l.defaultPrice)}</span>}
                        </td>
                        <td className="text-right font-medium tabular-nums">{inr((Number(l.price) || 0) * l.qty)}</td>
                        <td className="w-10"><button type="button" className="icon-btn !size-8 hover:text-danger" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove"><X size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section n={3} title="Delivery address">
            {!customer ? <p className="text-sm text-muted">Choose a customer first.</p> : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {savedAddresses.map((a) => (
                    <button type="button" key={a.id} onClick={() => setAddrMode(a.id)} className={`flex gap-3 rounded-2xl border p-3 text-left text-sm transition ${addrMode === a.id ? 'border-brown-800 bg-cream/50' : 'border-silver-300 bg-white/60 hover:border-bronze'}`}>
                      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${addrMode === a.id ? 'border-brown-800 bg-brown-800 text-white' : 'border-silver-400'}`}>{addrMode === a.id && <Check size={11} strokeWidth={3} />}</span>
                      <span><strong className="font-medium">{a.name}</strong> · {a.phone}<br /><span className="text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}</span></span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setAddrMode('new')} className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm transition ${addrMode === 'new' ? 'border-brown-800 bg-cream/50' : 'border-dashed border-silver-300 hover:border-bronze'}`}>
                    <MapPin size={18} className="text-bronze" /> {savedAddresses.length ? 'Use a new address' : 'Enter the delivery address'}
                  </button>
                </div>
                {addrMode === 'new' && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Name *"><input className="input" value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} /></Field>
                    <Field label="Phone *"><input className="input" inputMode="tel" value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} /></Field>
                    <Field label="Address line 1 *" className="sm:col-span-2"><input className="input" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} /></Field>
                    <Field label="Address line 2" className="sm:col-span-2"><input className="input" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} /></Field>
                    <Field label="City *"><input className="input" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></Field>
                    <Field label="State *"><input className="input" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} /></Field>
                    <Field label="PIN code *"><input className="input" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, '') })} /></Field>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="size-4 accent-[#3b2314]" /> Save to customer's addresses</label>
                  </div>
                )}
              </>
            )}
          </Section>

          <Section n={4} title="Order details" description="Status and tracking are shown to the customer on their order page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order status">
                <select className="input" value={form.status} onChange={set('status')}>{opts.statuses.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Tracking / AWB number"><input className="input" value={form.trackingNumber} onChange={set('trackingNumber')} placeholder="If already shipped" /></Field>
              <Field label="Payment method">
                <select className="input" value={form.paymentMethod} onChange={set('paymentMethod')}>{opts.paymentMethods.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Payment status">
                <select className="input" value={form.paymentStatus} onChange={set('paymentStatus')}>{opts.paymentStatuses.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              {form.status !== 'Placed' && (
                <Field label="Update note" hint="Shown in the customer's tracking timeline." className="sm:col-span-2">
                  <input className="input" value={form.statusNote} onChange={set('statusNote')} placeholder="e.g. Confirmed over phone" />
                </Field>
              )}
              <Field label="Note for the customer" hint="Printed on the invoice and order page." className="sm:col-span-2"><input className="input" value={form.notes} onChange={set('notes')} /></Field>
              <Field label="Internal notes" hint="Only visible to admins." className="sm:col-span-2"><textarea className="input !min-h-16" value={form.adminNotes} onChange={set('adminNotes')} /></Field>
            </div>
          </Section>
        </div>

        {/* Summary */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="card overflow-hidden">
            <div className="bg-linear-to-br from-brown-900 via-brown-800 to-brown-950 px-5 py-4 text-white">
              <p className="text-[11px] uppercase tracking-[.22em] text-gold-soft">Order summary</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-white/80"><User size={14} /> {customer ? customer.name : 'No customer selected'}</p>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between"><span className="text-muted">Items</span><span>{lines.reduce((s, l) => s + l.qty, 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="tabular-nums">{inr(subtotal)}</span></div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="disc" className="text-muted">Discount (₹)</label>
                <input id="disc" type="number" min="0" className="input !w-28 !py-1.5 text-right" value={form.discount} onChange={set('discount')} placeholder="0" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="ship" className="text-muted">Shipping (₹)</label>
                <input id="ship" type="number" min="0" className="input !w-28 !py-1.5 text-right" value={form.shipping} onChange={set('shipping')} placeholder={autoShipping ? String(autoShipping) : 'Free'} />
              </div>
              <div className="flex items-baseline justify-between border-t border-silver-200 pt-3">
                <span className="font-display text-xl font-semibold">Total</span>
                <span className="font-display text-3xl font-semibold tabular-nums text-brown-800">{inr(total)}</span>
              </div>
              <p className="text-xs text-muted">{form.paymentMethod} · {form.paymentStatus}</p>
              <button className="btn-primary w-full py-3" disabled={saving || !customer || !lines.length}>
                <Check size={16} /> {saving ? 'Creating order…' : 'Create order & invoice'}
              </button>
              <p className="text-center text-xs text-muted">Stock is deducted when the order is created.</p>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
