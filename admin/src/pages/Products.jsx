import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Eye, EyeOff, FolderTree, LayoutGrid, List, Package, Pencil, Plus, Star } from 'lucide-react';
import { api } from '../lib/api';
import { inr, SITE_URL } from '../lib/format';
import { ActivePill, EmptyState, PageHeader, PageLoader, SearchInput, Tabs } from '../components/ui';
import { useToast } from '../components/feedback';
import { useCategories } from '../lib/categories';

function StockBadge({ stock }) {
  const cls = stock === 0 ? 'bg-[#f5e0de] text-danger' : stock <= 10 ? 'bg-[#efe6d6] text-warning' : 'bg-silver-200 text-ink-2';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{stock === 0 ? 'Out of stock' : `${stock} in stock`}</span>;
}

export default function Products() {
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [params, setParams] = useSearchParams();
  const cat = params.get('category') || '';
  const sub = params.get('sub') || '';
  const setFilter = (category, subcategory = '') => {
    const next = {};
    if (category) next.category = category;
    if (subcategory) next.sub = subcategory;
    setParams(next, { replace: true });
  };
  const tree = useCategories();
  const [view, setView] = useState(() => { try { return localStorage.getItem('qe_admin_products_view') || 'list'; } catch { return 'list'; } });

  useEffect(() => { api.get('/products').then((d) => setList(d.products)).catch((e) => { toast(e.message, 'error'); setList([]); }); }, [toast]);
  useEffect(() => { try { localStorage.setItem('qe_admin_products_view', view); } catch { /* ignore */ } }, [view]);

  // tabs follow the admin-defined category order; any legacy names on products are appended
  const categories = useMemo(() => {
    const names = (tree || []).map((c) => c.name);
    const extra = [...new Set((list || []).map((p) => p.category).filter((c) => c && !names.includes(c)))];
    return [...names, ...extra];
  }, [tree, list]);
  const subs = useMemo(() => (tree || []).find((c) => c.name === cat)?.subcategories || [], [tree, cat]);
  const count = (fn) => (list || []).filter(fn).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list || []).filter((p) =>
      (!cat || p.category === cat) && (!sub || p.subcategory === sub)
      && (!s || `${p.name} ${p.subtitle} ${p.category} ${p.subcategory}`.toLowerCase().includes(s)));
  }, [list, q, cat, sub]);

  const toggleActive = async (p) => {
    try {
      const d = await api.put(`/products/${p.id}`, { active: !p.active });
      setList((l) => l.map((x) => (x.id === p.id ? d.product : x)));
      toast(d.product.active ? `${p.name} is now visible` : `${p.name} hidden from website`);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        subtitle="Manage pricing, stock, images and product page content."
        actions={
          <>
            <Link to="/categories" className="btn-outline"><FolderTree size={16} /> Categories</Link>
            <Link to="/products/new" className="btn-primary"><Plus size={16} /> New product</Link>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={cat}
          onChange={(c) => setFilter(c)}
          tabs={[{ value: '', label: 'All', count: list?.length }, ...categories.map((c) => ({ value: c, label: c, count: list ? count((p) => p.category === c) : undefined }))]}
        />
        <div className="flex items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search products" className="flex-1 lg:w-72" />
          <div className="flex rounded-full border border-silver-300 bg-white/70 p-0.5">
            {[['list', List], ['grid', LayoutGrid]].map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} className={`grid size-9 place-items-center rounded-full transition ${view === v ? 'bg-brown-800 text-white' : 'text-muted hover:text-ink'}`}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {cat && subs.length > 0 && (
        <div className="-mt-1 mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-[.16em] text-muted">{cat}:</span>
          {[{ name: '', label: 'All' }, ...subs.map((s) => ({ name: s.name, label: s.name }))].map((s) => (
            <button
              key={s.name || 'all'}
              onClick={() => setFilter(cat, s.name)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${sub === s.name ? 'border-bronze bg-cream text-brown-800' : 'border-silver-300 bg-white/60 text-ink-2 hover:border-bronze'}`}
            >
              {s.label}
              <span className="ml-1.5 text-muted">{count((p) => p.category === cat && (!s.name || p.subcategory === s.name))}</span>
            </button>
          ))}
        </div>
      )}

      {!list ? <div className="card"><PageLoader /></div> : shown.length === 0 ? (
        <div className="card">
          <EmptyState icon={Package} title={list.length ? 'No matching products' : 'No products yet'} action={!list.length && <Link to="/products/new" className="btn-primary"><Plus size={16} /> Add a product</Link>} />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((p) => (
            <article key={p.id} className={`card group flex animate-fade-up flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card ${p.active ? '' : 'opacity-70'}`}>
              <Link to={`/products/${p.id}`} className="relative block aspect-[4/3] overflow-hidden bg-linear-to-b from-[#f4f4f4] to-[#dedede]">
                {p.image ? <img src={p.image} alt={p.name} className="size-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-105" /> : <Package className="absolute inset-0 m-auto text-silver-400" size={40} />}
                <div className="absolute left-3 top-3 flex gap-1.5">
                  {p.featured && <span className="inline-flex items-center gap-1 rounded-full bg-brown-800 px-2.5 py-1 text-[11px] font-medium text-gold-soft"><Star size={11} fill="currentColor" /> Featured</span>}
                  {!p.active && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-muted">Hidden</span>}
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <p className="eyebrow !text-[10px]">{[p.category, p.subcategory, p.size].filter(Boolean).join(' · ')}</p>
                <Link to={`/products/${p.id}`} className="mt-1 font-display text-xl font-semibold leading-tight hover:text-brown-800">{p.name}</Link>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-lg font-semibold">{inr(p.price)}</span>
                  {p.mrp > p.price && <span className="text-sm text-muted line-through">{inr(p.mrp)}</span>}
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <StockBadge stock={p.stock} />
                  <button onClick={() => toggleActive(p)} className="icon-btn" title={p.active ? 'Hide from website' : 'Show on website'} aria-label={p.active ? 'Hide from website' : 'Show on website'}>
                    {p.active ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Price</th>
                  <th>Stock</th>
                  <th className="text-center">Featured</th>
                  <th>Website</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const off = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
                  return (
                    <tr key={p.id} className={`cursor-pointer ${p.active ? '' : 'opacity-70'}`} onClick={() => navigate(`/products/${p.id}`)}>
                      <td className="font-display text-lg text-bronze tabular-nums">{p.sortOrder}</td>
                      <td>
                        <div className="flex min-w-64 items-center gap-3">
                          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-linear-to-b from-[#f4f4f4] to-[#dedede]">
                            {p.image ? <img src={p.image} alt="" className="size-full object-cover mix-blend-multiply" /> : <Package size={20} className="text-silver-400" />}
                          </span>
                          <span className="min-w-0">
                            <Link to={`/products/${p.id}`} onClick={(e) => e.stopPropagation()} className="block font-medium hover:text-brown-800 hover:underline">{p.name}</Link>
                            {p.subtitle && <span className="block max-w-72 truncate text-xs text-muted">{p.subtitle}</span>}
                            {p.size && <span className="mt-0.5 inline-block rounded-md bg-silver-100 px-1.5 py-px text-[11px] text-ink-2">{p.size}</span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="whitespace-nowrap text-ink-2">{p.category || <span className="text-muted">—</span>}</div>
                        {p.subcategory && <div className="whitespace-nowrap text-xs text-muted">↳ {p.subcategory}</div>}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <div className="font-medium tabular-nums">{inr(p.price)}</div>
                        {off > 0 && <div className="text-xs text-muted"><span className="line-through">{inr(p.mrp)}</span> <span className="font-medium text-success">{off}% off</span></div>}
                      </td>
                      <td><StockBadge stock={p.stock} /></td>
                      <td className="text-center">
                        {p.featured ? <Star size={16} className="mx-auto fill-gold text-gold" aria-label="Featured" /> : <span className="text-silver-400">—</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.active}
                          onClick={() => toggleActive(p)}
                          className="flex items-center gap-2 text-xs font-medium"
                          title={p.active ? 'Hide from website' : 'Show on website'}
                        >
                          <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${p.active ? 'bg-brown-800' : 'bg-silver-300'}`}>
                            <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${p.active ? 'left-[18px]' : 'left-0.5'}`} />
                          </span>
                          <span className={p.active ? 'text-success' : 'text-muted'}>{p.active ? 'Visible' : 'Hidden'}</span>
                        </button>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/products/${p.id}`} className="icon-btn !size-8" title="Edit" aria-label={`Edit ${p.name}`}><Pencil size={15} /></Link>
                          {p.active ? (
                            <a href={`${SITE_URL}/product/${p.slug}`} target="_blank" rel="noreferrer" className="icon-btn !size-8" title="View on website" aria-label={`View ${p.name} on website`}><ExternalLink size={15} /></a>
                          ) : (
                            <span className="icon-btn !size-8 opacity-30" title="Hidden from website"><EyeOff size={15} /></span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-silver-200/80 bg-silver-50/60 px-4 py-2.5 text-xs text-muted">
            <span>Showing {shown.length} of {list.length} product{list.length === 1 ? '' : 's'}</span>
            <span>Click a row to edit · # is the display order on the website</span>
          </div>
        </div>
      )}
    </div>
  );
}
