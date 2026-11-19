import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ExternalLink, Minus, Package, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { inr, SITE_URL } from '../lib/format';
import { Alert, Field, ImageUpload, PageHeader, PageLoader, Toggle } from '../components/ui';
import { useConfirm, useToast } from '../components/feedback';

const EMPTY = {
  name: '', tagline: '', description: '', banner: '', image: '', items: [], mrp: '', price: '',
  ritualTitle: 'Your hair-care ritual', steps: [{ title: '', text: '', productId: '', description: '' }], experienceTitle: 'A complete hair-care experience',
  highlights: [''], closing: '', sortOrder: 99, featured: true, active: true, slug: '',
};

function Section({ title, description, action, children }) {
  return (
    <section className="card card-pad">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="card-title">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const move = (arr, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

export default function ComboForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [products, setProducts] = useState(null);
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/products').then((d) => setProducts(d.products)).catch(() => setProducts([])); }, []);
  useEffect(() => {
    if (isNew) { setForm(EMPTY); return; }
    api.get(`/combos/${id}`).then((d) => {
      const c = d.combo;
      setForm({
        ...EMPTY, ...c,
        items: c.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        mrp: c.mrp === c.itemsMrp ? '' : c.mrp, // blank = use the products' total
        steps: c.steps?.length
          ? c.steps.map((s) => ({ title: s.title, text: s.text, productId: s.productId || '', description: s.description || '' }))
          : [{ title: '', text: '', productId: '', description: '' }],
        highlights: c.highlights?.length ? c.highlights : [''],
      });
      setDirty(false);
    }).catch((e) => setError(e.message));
  }, [id, isNew]);

  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const byId = useMemo(() => Object.fromEntries((products || []).map((p) => [p.id, p])), [products]);

  if (!form || !products) return error ? <Alert>{error}</Alert> : <PageLoader />;

  const update = (patch) => { setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) })); setDirty(true); };
  const set = (k) => (e) => update({ [k]: e.target.value });

  // totals
  const itemsMrp = form.items.reduce((s, i) => s + (byId[i.productId]?.mrp || 0) * i.qty, 0);
  const itemsPrice = form.items.reduce((s, i) => s + (byId[i.productId]?.price || 0) * i.qty, 0);
  const units = form.items.reduce((s, i) => s + i.qty, 0);
  const mrp = Number(form.mrp) || itemsMrp;
  const price = Number(form.price) || 0;
  const savePct = mrp > price && price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const kitsInStock = form.items.length ? Math.min(...form.items.map((i) => Math.floor((byId[i.productId]?.stock || 0) / i.qty))) : 0;

  const addProduct = () => {
    if (!pick) return;
    update((f) => ({
      items: f.items.some((i) => i.productId === pick)
        ? f.items.map((i) => (i.productId === pick ? { ...i, qty: Math.min(50, i.qty + 1) } : i))
        : [...f.items, { productId: pick, qty: 1 }],
    }));
    setPick('');
  };
  const setQty = (pid, qty) => update((f) => ({ items: f.items.map((i) => (i.productId === pid ? { ...i, qty: Math.max(1, Math.min(50, qty)) } : i)) }));

  const save = async (e) => {
    e?.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        ...form,
        mrp: Number(form.mrp) || 0,
        price: Number(form.price) || 0,
        sortOrder: Number(form.sortOrder) || 0,
        steps: form.steps.filter((s) => s.title.trim()),
        highlights: form.highlights.filter((h) => h.trim()),
        image: form.image || form.banner,
      };
      if (isNew) delete body.slug;
      const d = isNew ? await api.post('/combos', body) : await api.put(`/combos/${id}`, body);
      setDirty(false);
      toast(isNew ? `Combo ${d.combo.name} created` : 'Combo saved');
      if (isNew) navigate(`/combos/${d.combo.id}`, { replace: true });
      else setForm((f) => ({ ...f, slug: d.combo.slug }));
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `Delete ${form.name}?`, body: 'If this combo appears in past orders it will be hidden from the website instead.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      const d = await api.del(`/combos/${id}`);
      toast(d.message);
      setDirty(false);
      navigate('/combos');
    } catch (e2) { toast(e2.message, 'error'); }
  };

  const available = products.filter((p) => !form.items.some((i) => i.productId === p.id));

  return (
    <form onSubmit={save}>
      <PageHeader
        back={{ to: '/combos', label: 'Combos' }}
        eyebrow={isNew ? 'New combo' : 'Edit combo'}
        title={form.name || 'Untitled combo'}
        subtitle={dirty ? <span className="text-warning">Unsaved changes</span> : !isNew && 'All changes saved'}
        actions={
          <>
            {!isNew && form.active && <a className="btn-outline" href={`${SITE_URL}/combo/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View</a>}
            {!isNew && <button type="button" className="btn-danger" onClick={remove}><Trash2 size={15} /> Delete</button>}
            <button className="btn-primary" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : isNew ? 'Create combo' : 'Save'}</button>
          </>
        }
      />
      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Section title="Basics" description="Shown on the combo card and at the top of the combo page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Combo name *"><input className="input font-medium tracking-wide" value={form.name} onChange={set('name')} placeholder="e.g. VITALORA" required /></Field>
              <Field label="Tagline"><input className="input" value={form.tagline} onChange={set('tagline')} placeholder="The Hair Vitality Ritual" /></Field>
              <Field label="Description" className="sm:col-span-2"><textarea className="input !min-h-20" value={form.description} onChange={set('description')} placeholder="A complete daily hair-care kit for…" /></Field>
              <Field label="Closing line" hint="The banner line at the bottom of the combo page." className="sm:col-span-2"><input className="input" value={form.closing} onChange={set('closing')} placeholder="VITALORA – A complete ritual for your daily hair vitality." /></Field>
            </div>
          </Section>

          <Section title="Products in this kit" description="Choose the products and how many of each go into one kit.">
            <div className="flex gap-2">
              <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Product to add">
                <option value="">Select a product to add…</option>
                {available.map((p) => <option key={p.id} value={p.id}>{p.name}{p.size ? ` (${p.size})` : ''} — {inr(p.mrp)}{p.active ? '' : ' · hidden'}</option>)}
              </select>
              <button type="button" className="btn-primary shrink-0" onClick={addProduct} disabled={!pick}><Plus size={15} /> Add</button>
            </div>

            {form.items.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-silver-300 py-8 text-center text-sm text-muted">No products yet — add the first one above.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-silver-200">
                <table className="table">
                  <thead><tr><th>Product</th><th className="text-right">MRP each</th><th className="text-center">Qty per kit</th><th className="text-right">Line MRP</th><th /></tr></thead>
                  <tbody>
                    {form.items.map((i) => {
                      const p = byId[i.productId];
                      return (
                        <tr key={i.productId}>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-silver-100">{p?.image ? <img src={p.image} alt="" className="size-full object-cover" /> : <Package size={16} className="text-silver-400" />}</span>
                              <span className="min-w-0">
                                <span className="block font-medium">{p?.name || 'Deleted product'}</span>
                                <span className="block text-xs text-muted">{[p?.size, p && `${p.stock} in stock`, p && !p.active && 'hidden'].filter(Boolean).join(' · ')}</span>
                              </span>
                            </div>
                          </td>
                          <td className="text-right tabular-nums text-muted">{inr(p?.mrp || 0)}</td>
                          <td>
                            <div className="mx-auto flex w-fit items-center rounded-full border border-silver-300 bg-white">
                              <button type="button" className="grid size-8 place-items-center text-ink-2 disabled:opacity-30" onClick={() => setQty(i.productId, i.qty - 1)} disabled={i.qty <= 1} aria-label="Fewer"><Minus size={14} /></button>
                              <span className="w-7 text-center text-sm font-semibold tabular-nums">{i.qty}</span>
                              <button type="button" className="grid size-8 place-items-center text-ink-2" onClick={() => setQty(i.productId, i.qty + 1)} aria-label="More"><Plus size={14} /></button>
                            </div>
                          </td>
                          <td className="text-right font-medium tabular-nums">{inr((p?.mrp || 0) * i.qty)}</td>
                          <td className="w-10"><button type="button" className="icon-btn !size-8 hover:text-danger" onClick={() => update((f) => ({ items: f.items.filter((x) => x.productId !== i.productId) }))} aria-label="Remove"><X size={16} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-silver-50/80 text-sm">
                      <td className="px-4 py-3 font-medium">{units} piece{units === 1 ? '' : 's'} per kit</td>
                      <td colSpan={2} className="px-4 py-3 text-right text-muted">Products' total MRP</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{inr(itemsMrp)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          <Section
            title="Ritual steps"
            description="How to use the kit — each step shows on the combo page with its product photo and these directions."
            action={<button type="button" className="btn-outline btn-sm" onClick={() => update((f) => ({ steps: [...f.steps, { title: '', text: '', productId: '', description: '' }] }))}><Plus size={14} /> Step</button>}
          >
            <Field label="Section heading"><input className="input" value={form.ritualTitle} onChange={set('ritualTitle')} /></Field>
            <ol className="mt-4 space-y-3">
              {form.steps.map((s, i) => {
                const setStep = (patch) => update((f) => ({ steps: f.steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                const linked = byId[s.productId];
                return (
                  <li key={i} className="rounded-2xl border border-silver-200 bg-white/60 p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="shrink-0 rounded-full bg-linear-to-br from-gold-soft to-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brown-950">Step {i + 1}</span>
                      <input className="input !py-2" placeholder="Title — e.g. Cleanse" value={s.title} onChange={(e) => setStep({ title: e.target.value })} aria-label={`Step ${i + 1} title`} />
                      <input className="input !py-2" placeholder="Short line — e.g. with Velvera Shampoo" value={s.text} onChange={(e) => setStep({ text: e.target.value })} aria-label={`Step ${i + 1} short line`} />
                      <div className="flex shrink-0">
                        <button type="button" className="icon-btn !size-8" onClick={() => update((f) => ({ steps: move(f.steps, i, -1) }))} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                        <button type="button" className="icon-btn !size-8" onClick={() => update((f) => ({ steps: move(f.steps, i, 1) }))} disabled={i === form.steps.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                        <button type="button" className="icon-btn !size-8 hover:text-danger" onClick={() => update((f) => ({ steps: f.steps.filter((_, j) => j !== i) }))} aria-label="Remove step"><X size={14} /></button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                      <div>
                        <label className="label">Product used</label>
                        <div className="flex items-center gap-2">
                          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-silver-100">
                            {linked?.image ? <img src={linked.image} alt="" className="size-full object-cover" /> : <Package size={15} className="text-silver-400" />}
                          </span>
                          <select
                            className="input !py-2"
                            value={s.productId}
                            onChange={(e) => {
                              const p = byId[e.target.value];
                              // fill the short line the first time a product is picked
                              setStep({ productId: e.target.value, ...(p && !s.text ? { text: `with ${p.name}` } : {}) });
                            }}
                          >
                            <option value="">None (routine step)</option>
                            {form.items.map((it) => <option key={it.productId} value={it.productId}>{byId[it.productId]?.name || 'Product'}</option>)}
                          </select>
                        </div>
                        {!form.items.length && <p className="hint">Add products to the kit first.</p>}
                      </div>
                      <div>
                        <label className="label">How to use</label>
                        <textarea
                          className="input !min-h-28"
                          value={s.description}
                          onChange={(e) => setStep({ description: e.target.value })}
                          placeholder="e.g. Wet your hair, work a small amount into a lather over the scalp, massage for 1–2 minutes and rinse well."
                          maxLength={1500}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section
            title="Highlights"
            description="The ✓ list under the experience heading."
            action={<button type="button" className="btn-outline btn-sm" onClick={() => update((f) => ({ highlights: [...f.highlights, ''] }))}><Plus size={14} /> Point</button>}
          >
            <Field label="Section heading"><input className="input" value={form.experienceTitle} onChange={set('experienceTitle')} /></Field>
            <ul className="mt-4 space-y-2">
              {form.highlights.map((h, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold text-xs font-bold text-brown-950">✓</span>
                  <input className="input !py-2" value={h} placeholder="A well-designed 3-step hair-care routine" onChange={(e) => update((f) => ({ highlights: f.highlights.map((x, j) => (j === i ? e.target.value : x)) }))} />
                  <button type="button" className="icon-btn !size-8 shrink-0 hover:text-danger" onClick={() => update((f) => ({ highlights: f.highlights.filter((_, j) => j !== i) }))} aria-label="Remove point"><X size={14} /></button>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <aside className="space-y-5">
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Offer price (₹) *"><input className="input" type="number" min="0" value={form.price} onChange={set('price')} required /></Field>
              <Field label="MRP (₹)" hint={`Blank = products' total ${inr(itemsMrp)}`}>
                <input className="input" type="number" min="0" value={form.mrp} onChange={set('mrp')} placeholder={String(itemsMrp || '')} />
              </Field>
            </div>
            {Number(form.mrp) > 0 && itemsMrp > 0 && Number(form.mrp) !== itemsMrp && (
              <p className="mt-2 rounded-lg bg-[#efe6d6] px-3 py-2 text-xs text-warning">MRP differs from the products' total ({inr(itemsMrp)}). Customers will see {inr(mrp)} struck through.</p>
            )}
            {price > 0 && (
              <div className="mt-4 rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted">Customer pays</span><strong className="text-base">{inr(price)}</strong></div>
                {savePct > 0 && <div className="mt-1 flex items-center justify-between"><span className="text-muted">Saves</span><span className="font-medium text-success">{inr(mrp - price)} · {savePct}% off</span></div>}
                {itemsPrice > 0 && <div className="mt-1 flex items-center justify-between text-xs text-muted"><span>Products at selling price</span><span>{inr(itemsPrice)}</span></div>}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-silver-200 px-4 py-2.5 text-sm">
              <span className="text-muted">Kits available from stock</span>
              <strong className={kitsInStock ? '' : 'text-danger'}>{form.items.length ? kitsInStock : '—'}</strong>
            </div>
            <div className="mt-3 divide-y divide-silver-200 border-t border-silver-200">
              <Toggle checked={form.active} onChange={(v) => update({ active: v })} label="Visible on website" description="Hidden combos can't be ordered." />
              <Toggle checked={form.featured} onChange={(v) => update({ featured: v })} label="Show on home page" description="In the Signature Kits section." />
            </div>
            <Field label="Sort order" hint="Lower shows first." className="mt-3"><input className="input" type="number" min="0" value={form.sortOrder} onChange={set('sortOrder')} /></Field>
          </Section>

          <Section title="Banner / poster" description="Wide image (16:9) — used on the card and combo page.">
            <ImageUpload value={form.banner} onChange={(url) => update({ banner: url, image: url })} label="Upload combo poster" className="aspect-video" />
            {form.banner && <button type="button" className="mt-2 text-sm text-danger hover:underline" onClick={() => update({ banner: '', image: '' })}>Remove image</button>}
          </Section>

          {!isNew && (
            <Section title="URL">
              <Field label="Slug" hint={`${SITE_URL || ''}/combo/${form.slug || '…'}`}>
                <input className="input font-mono text-xs" value={form.slug} onChange={set('slug')} />
              </Field>
            </Section>
          )}
          {!isNew && <p className="px-1 text-xs text-muted">Changing the products here doesn't affect orders already placed.</p>}
          <Link to="/products" className="block px-1 text-xs text-muted hover:text-brown-800">Need a new product? Add it in Products first →</Link>
        </aside>
      </div>
    </form>
  );
}
