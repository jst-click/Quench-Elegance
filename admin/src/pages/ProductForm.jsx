import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, GripVertical, Plus, Save, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { inr, SITE_URL } from '../lib/format';
import { useCategories } from '../lib/categories';
import { Alert, Field, ImageUpload, PageHeader, PageLoader, Toggle } from '../components/ui';
import { useConfirm, useToast } from '../components/feedback';

const EMPTY = {
  name: '', subtitle: '', category: '', subcategory: '', size: '', mrp: '', price: '', stock: 0, sortOrder: 99, featured: false, active: true,
  image: '', gallery: [], tagline: '', highlight: '', shortDescription: '', intro: '', benefits: [], ingredients: '', tags: '',
  closingTitle: '', closingBody: '', signature: '', slug: '',
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

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const tree = useCategories();

  useEffect(() => {
    if (isNew) { setForm(EMPTY); return; }
    api.get(`/products/${id}`).then((d) => {
      const p = d.product;
      setForm({ ...EMPTY, ...p, ingredients: (p.ingredients || []).join('\n'), tags: (p.tags || []).join(', '), gallery: p.gallery || [], benefits: p.benefits || [] });
      setDirty(false);
    }).catch((e) => setError(e.message));
  }, [id, isNew]);

  // warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!form) return error ? <Alert>{error}</Alert> : <PageLoader />;

  const update = (patch) => { setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) })); setDirty(true); };
  const set = (k) => (e) => update({ [k]: e.target.value });
  const setBenefit = (i, k, v) => update((f) => ({ benefits: f.benefits.map((b, j) => (j === i ? { ...b, [k]: v } : b)) }));
  const moveBenefit = (i, dir) => update((f) => {
    const b = [...f.benefits];
    const j = i + dir;
    if (j < 0 || j >= b.length) return {};
    [b[i], b[j]] = [b[j], b[i]];
    return { benefits: b };
  });

  const subOptions = (tree || []).find((c) => c.name === form.category)?.subcategories || [];
  const price = Number(form.price) || 0;
  const mrp = Number(form.mrp) || 0;
  const discount = mrp > price && price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const save = async (e) => {
    e?.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { ...form, mrp: Number(form.mrp) || Number(form.price), price: Number(form.price), stock: Number(form.stock), sortOrder: Number(form.sortOrder) };
      if (isNew) {
        delete body.slug;
        const d = await api.post('/products', body);
        toast('Product created');
        setDirty(false);
        navigate(`/products/${d.product.id}`, { replace: true });
      } else {
        const d = await api.put(`/products/${id}`, body);
        setForm((f) => ({ ...f, slug: d.product.slug }));
        setDirty(false);
        toast('Product saved');
      }
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: `Delete ${form.name}?`, body: 'If this product appears in past orders it will be hidden from the website instead of deleted.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      const d = await api.del(`/products/${id}`);
      toast(d.message);
      setDirty(false);
      navigate('/products');
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <form onSubmit={save}>
      <PageHeader
        back={{ to: '/products', label: 'Products' }}
        eyebrow={isNew ? 'New product' : 'Edit product'}
        title={form.name || 'Untitled product'}
        subtitle={dirty ? <span className="text-warning">Unsaved changes</span> : !isNew && 'All changes saved'}
        actions={
          <>
            {!isNew && form.active && (
              <a className="btn-outline" href={`${SITE_URL}/product/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View</a>
            )}
            {!isNew && <button type="button" className="btn-danger" onClick={remove}><Trash2 size={15} /> Delete</button>}
            <button className="btn-primary" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : isNew ? 'Create product' : 'Save'}</button>
          </>
        }
      />
      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Section
            title="Basics"
            description="Name, category and the copy shown on product cards."
            action={<Link to="/categories" className="link text-sm">Manage categories</Link>}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name *" className="sm:col-span-2"><input className="input" value={form.name} onChange={set('name')} required /></Field>
              <Field label="Subtitle" className="sm:col-span-2"><input className="input" value={form.subtitle} onChange={set('subtitle')} placeholder="e.g. Advanced Botanical Hair Nourishment Oil" /></Field>
              <Field label="Main category *">
                <select
                  className="input"
                  value={form.category}
                  onChange={(e) => update({ category: e.target.value, subcategory: '' })}
                  required
                  disabled={!tree}
                >
                  <option value="">{tree ? 'Select a category' : 'Loading…'}</option>
                  {(tree || []).map((c) => <option key={c.id} value={c.name}>{c.name}{c.active ? '' : ' (hidden)'}</option>)}
                  {/* keep a legacy value selectable if it isn't in the category list */}
                  {form.category && tree && !tree.some((c) => c.name === form.category) && <option value={form.category}>{form.category} (not in list)</option>}
                </select>
              </Field>
              <Field
                label="Subcategory"
                hint={subOptions.length ? 'Optional' : form.category ? <>None yet — <Link to="/categories" className="link">add subcategories</Link></> : 'Pick a main category first'}
              >
                <select className="input" value={form.subcategory} onChange={set('subcategory')} disabled={!subOptions.length && !form.subcategory}>
                  <option value="">{subOptions.length ? 'No subcategory' : '—'}</option>
                  {subOptions.map((s) => <option key={s.id} value={s.name}>{s.name}{s.active ? '' : ' (hidden)'}</option>)}
                  {form.subcategory && !subOptions.some((s) => s.name === form.subcategory) && <option value={form.subcategory}>{form.subcategory} (not in list)</option>}
                </select>
              </Field>
              <Field label="Size"><input className="input" value={form.size} onChange={set('size')} placeholder="100 ml" /></Field>
              <Field label="Tagline"><input className="input" value={form.tagline} onChange={set('tagline')} /></Field>
              <Field label="Highlight chip"><input className="input" value={form.highlight} onChange={set('highlight')} placeholder="62+ botanical ingredients" /></Field>
              <Field label="Short description" className="sm:col-span-2"><textarea className="input" value={form.shortDescription} onChange={set('shortDescription')} /></Field>
              <Field label="Introduction" hint="The opening paragraph on the product page." className="sm:col-span-2"><textarea className="input !min-h-32" value={form.intro} onChange={set('intro')} /></Field>
            </div>
          </Section>

          <Section
            title="Benefits"
            description="Numbered benefit blocks on the product page."
            action={<button type="button" className="btn-outline btn-sm" onClick={() => update((f) => ({ benefits: [...f.benefits, { title: '', body: '' }] }))}><Plus size={14} /> Add</button>}
          >
            {form.benefits.length === 0 ? (
              <p className="rounded-xl border border-dashed border-silver-300 py-8 text-center text-sm text-muted">No benefits yet — add the first one.</p>
            ) : (
              <ol className="space-y-3">
                {form.benefits.map((b, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl border border-silver-200 bg-white/60 p-3">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <span className="font-display text-xl font-semibold text-bronze">{String(i + 1).padStart(2, '0')}</span>
                      <button type="button" className="text-silver-500 hover:text-ink disabled:opacity-30" onClick={() => moveBenefit(i, -1)} disabled={i === 0} aria-label="Move up">▲</button>
                      <GripVertical size={14} className="text-silver-400" />
                      <button type="button" className="text-silver-500 hover:text-ink disabled:opacity-30" onClick={() => moveBenefit(i, 1)} disabled={i === form.benefits.length - 1} aria-label="Move down">▼</button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <input className="input" placeholder="Benefit title" value={b.title} onChange={(e) => setBenefit(i, 'title', e.target.value)} />
                      <textarea className="input !min-h-16" placeholder="Description" value={b.body} onChange={(e) => setBenefit(i, 'body', e.target.value)} />
                    </div>
                    <button type="button" className="icon-btn shrink-0 hover:text-danger" aria-label="Remove benefit" onClick={() => update((f) => ({ benefits: f.benefits.filter((_, j) => j !== i) }))}><X size={16} /></button>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Ingredients & closing" description="Ingredient list, tags and the closing message of the product page.">
            <div className="grid gap-4">
              <Field label="Ingredients" hint="One per line or comma-separated.">
                <textarea className="input !min-h-36" value={form.ingredients} onChange={set('ingredients')} />
              </Field>
              <Field label="Tags" hint="Comma-separated, e.g. Botanical, Nourishing, Daily Care">
                <input className="input" value={form.tags} onChange={set('tags')} />
              </Field>
              {form.tags && (
                <div className="-mt-2 flex flex-wrap gap-1.5">
                  {form.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="rounded-full bg-cream px-2.5 py-0.5 text-xs text-brown-800">{t}</span>)}
                </div>
              )}
              <Field label="Closing headline"><input className="input" value={form.closingTitle} onChange={set('closingTitle')} /></Field>
              <Field label="Closing text"><textarea className="input !min-h-20" value={form.closingBody} onChange={set('closingBody')} /></Field>
              <Field label="Signature line"><input className="input" value={form.signature} onChange={set('signature')} /></Field>
            </div>
          </Section>
        </div>

        <aside className="space-y-5">
          <Section title="Pricing & stock">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Selling price (₹) *"><input className="input" type="number" min="0" value={form.price} onChange={set('price')} required /></Field>
              <Field label="MRP (₹)"><input className="input" type="number" min="0" value={form.mrp} onChange={set('mrp')} /></Field>
              <Field label="Stock"><input className="input" type="number" min="0" value={form.stock} onChange={set('stock')} /></Field>
              <Field label="Sort order" hint="Lower shows first."><input className="input" type="number" min="0" value={form.sortOrder} onChange={set('sortOrder')} /></Field>
            </div>
            {price > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-cream/60 px-4 py-3 text-sm">
                <span className="text-muted">Customer pays</span>
                <span><strong className="text-base">{inr(price)}</strong>{discount > 0 && <span className="ml-2 rounded-full bg-brown-800 px-2 py-0.5 text-[11px] text-gold-soft">{discount}% off</span>}</span>
              </div>
            )}
            <div className="mt-4 divide-y divide-silver-200 border-t border-silver-200">
              <Toggle checked={form.active} onChange={(v) => update({ active: v })} label="Visible on website" description="Hidden products can't be ordered." />
              <Toggle checked={form.featured} onChange={(v) => update({ featured: v })} label="Feature on home page" />
            </div>
          </Section>

          <Section title="Images" description="JPG, PNG or WEBP under 5 MB.">
            <ImageUpload value={form.image} onChange={(url) => update({ image: url })} label="Upload main image" />
            {form.image && <button type="button" className="mt-2 text-sm text-danger hover:underline" onClick={() => update({ image: '' })}>Remove main image</button>}
            <p className="label mt-5">Gallery</p>
            <div className="grid grid-cols-3 gap-2">
              {form.gallery.map((g) => (
                <div key={g} className="group relative aspect-square overflow-hidden rounded-xl bg-silver-100">
                  <img src={g} alt="" className="size-full object-cover" />
                  <button type="button" onClick={() => update((f) => ({ gallery: f.gallery.filter((x) => x !== g) }))} aria-label="Remove" className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-brown-950/70 text-white opacity-0 transition group-hover:opacity-100">
                    <X size={13} />
                  </button>
                </div>
              ))}
              <ImageUpload value="" label="Add" onChange={(url) => update((f) => ({ gallery: [...f.gallery, url] }))} />
            </div>
          </Section>

          {!isNew && (
            <Section title="URL">
              <Field label="Slug" hint={`${SITE_URL || ''}/product/${form.slug || '…'}`}>
                <input className="input font-mono text-xs" value={form.slug} onChange={set('slug')} />
              </Field>
            </Section>
          )}
        </aside>
      </div>
    </form>
  );
}
