import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { adminApi } from '../api';
import { useToast } from '../context/AppContext';
import { CATEGORIES } from '../content';

const EMPTY = {
  name: '', subtitle: '', category: 'Hair Oil', size: '', mrp: '', price: '', stock: 0, sortOrder: 99, featured: false, active: true,
  image: '', gallery: [], tagline: '', highlight: '', shortDescription: '', intro: '', benefits: [], ingredients: '', tags: '',
  closingTitle: '', closingBody: '', signature: '', slug: '',
};

function ImageUpload({ value, onChange, label = 'Upload image' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try { const d = await adminApi.upload(f); onChange(d.url); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); e.target.value = ''; }
  };
  return (
    <label className={`img-upload ${value ? 'has' : ''}`}>
      {value ? <img src={value} alt="" /> : <span><ImagePlus size={22} />{busy ? 'Uploading…' : label}</span>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} hidden />
    </label>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    adminApi.get(`/products/${id}`).then((d) => {
      const p = d.product;
      setForm({ ...EMPTY, ...p, ingredients: (p.ingredients || []).join('\n'), tags: (p.tags || []).join(', '), gallery: p.gallery || [], benefits: p.benefits || [] });
    }).catch((e) => setError(e.message));
  }, [id, isNew]);

  if (!form) return error ? <div className="alert alert-error">{error}</div> : <div className="page-loader"><div className="spinner" /></div>;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setBenefit = (i, k, v) => setForm((f) => ({ ...f, benefits: f.benefits.map((b, j) => (j === i ? { ...b, [k]: v } : b)) }));

  const save = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const body = { ...form, mrp: Number(form.mrp) || Number(form.price), price: Number(form.price), stock: Number(form.stock), sortOrder: Number(form.sortOrder) };
      if (isNew) {
        const d = await adminApi.post('/products', body);
        toast('Product created');
        navigate(`/admin/products/${d.product.id}`, { replace: true });
      } else {
        const d = await adminApi.put(`/products/${id}`, body);
        setForm((f) => ({ ...f, slug: d.product.slug }));
        toast('Product saved');
      }
    } catch (err) { setError(err.message); window.scrollTo(0, 0); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${form.name}?`)) return;
    const d = await adminApi.del(`/products/${id}`);
    toast(d.message);
    navigate('/admin/products');
  };

  return (
    <form className="adm-page" onSubmit={save}>
      <Link to="/admin/products" className="back-link"><ArrowLeft size={16} /> Products</Link>
      <div className="adm-head">
        <h1>{isNew ? 'New product' : form.name}</h1>
        <div className="adm-actions">
          {!isNew && form.active && <a className="btn btn-outline btn-sm" href={`/product/${form.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View</a>}
          {!isNew && <button type="button" className="btn btn-outline btn-sm danger" onClick={remove}><Trash2 size={15} /> Delete</button>}
          <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="pf-layout">
        <div className="pf-main">
          <section className="adm-card">
            <h2>Basics</h2>
            <div className="form-grid">
              <div className="field span-2"><label>Product name *</label><input className="input" value={form.name} onChange={set('name')} required /></div>
              <div className="field span-2"><label>Subtitle</label><input className="input" value={form.subtitle} onChange={set('subtitle')} placeholder="e.g. Advanced Botanical Hair Nourishment Oil" /></div>
              <div className="field"><label>Category</label>
                <input className="input" list="cats" value={form.category} onChange={set('category')} />
                <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="field"><label>Size</label><input className="input" value={form.size} onChange={set('size')} placeholder="100 ml" /></div>
              <div className="field"><label>Tagline</label><input className="input" value={form.tagline} onChange={set('tagline')} /></div>
              <div className="field"><label>Highlight chip</label><input className="input" value={form.highlight} onChange={set('highlight')} placeholder="62+ botanical ingredients" /></div>
              <div className="field span-2"><label>Short description</label><textarea className="textarea" value={form.shortDescription} onChange={set('shortDescription')} /></div>
              <div className="field span-2"><label>Introduction (product page)</label><textarea className="textarea" value={form.intro} onChange={set('intro')} /></div>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card-head"><h2>Benefits</h2><button type="button" className="btn btn-outline btn-sm" onClick={() => setForm((f) => ({ ...f, benefits: [...f.benefits, { title: '', body: '' }] }))}><Plus size={15} /> Add</button></div>
            {form.benefits.length === 0 && <p className="muted">No benefits yet.</p>}
            <div className="benefit-edit">
              {form.benefits.map((b, i) => (
                <div key={i} className="benefit-row">
                  <span className="benefit-idx">{String(i + 1).padStart(2, '0')}</span>
                  <div className="benefit-fields">
                    <input className="input" placeholder="Title" value={b.title} onChange={(e) => setBenefit(i, 'title', e.target.value)} />
                    <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Description" value={b.body} onChange={(e) => setBenefit(i, 'body', e.target.value)} />
                  </div>
                  <button type="button" className="icon-btn sm" aria-label="Remove benefit" onClick={() => setForm((f) => ({ ...f, benefits: f.benefits.filter((_, j) => j !== i) }))}><X size={16} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="adm-card">
            <h2>Ingredients & closing</h2>
            <div className="form-grid">
              <div className="field span-2"><label>Ingredients (one per line or comma-separated)</label><textarea className="textarea" style={{ minHeight: 140 }} value={form.ingredients} onChange={set('ingredients')} /></div>
              <div className="field span-2"><label>Tags (comma-separated)</label><input className="input" value={form.tags} onChange={set('tags')} placeholder="Botanical, Nourishing, Daily Care" /></div>
              <div className="field span-2"><label>Closing headline</label><input className="input" value={form.closingTitle} onChange={set('closingTitle')} /></div>
              <div className="field span-2"><label>Closing text</label><textarea className="textarea" style={{ minHeight: 70 }} value={form.closingBody} onChange={set('closingBody')} /></div>
              <div className="field span-2"><label>Signature line</label><input className="input" value={form.signature} onChange={set('signature')} /></div>
            </div>
          </section>
        </div>

        <aside className="pf-side">
          <section className="adm-card">
            <h2>Pricing & stock</h2>
            <div className="form-grid">
              <div className="field"><label>Selling price (₹) *</label><input className="input" type="number" min="0" value={form.price} onChange={set('price')} required /></div>
              <div className="field"><label>MRP (₹)</label><input className="input" type="number" min="0" value={form.mrp} onChange={set('mrp')} /></div>
              <div className="field"><label>Stock</label><input className="input" type="number" min="0" value={form.stock} onChange={set('stock')} /></div>
              <div className="field"><label>Sort order</label><input className="input" type="number" min="0" value={form.sortOrder} onChange={set('sortOrder')} /></div>
            </div>
            <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Visible on website</label>
            <label className="check"><input type="checkbox" checked={form.featured} onChange={set('featured')} /> Feature on home page</label>
          </section>
          <section className="adm-card">
            <h2>Main image</h2>
            <ImageUpload value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} />
            {form.image && <button type="button" className="btn-link" onClick={() => setForm((f) => ({ ...f, image: '' }))}>Remove image</button>}
            <h3 className="adm-sub">Gallery</h3>
            <div className="gallery-edit">
              {form.gallery.map((g) => (
                <div key={g} className="gallery-thumb"><img src={g} alt="" /><button type="button" onClick={() => setForm((f) => ({ ...f, gallery: f.gallery.filter((x) => x !== g) }))} aria-label="Remove"><X size={14} /></button></div>
              ))}
              <ImageUpload value="" label="Add" onChange={(url) => setForm((f) => ({ ...f, gallery: [...f.gallery, url] }))} />
            </div>
          </section>
          {!isNew && (
            <section className="adm-card">
              <h2>URL</h2>
              <div className="field"><label>Slug</label><input className="input" value={form.slug} onChange={set('slug')} /></div>
            </section>
          )}
        </aside>
      </div>
    </form>
  );
}
