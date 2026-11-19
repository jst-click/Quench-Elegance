import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api';
import { CATEGORIES } from '../content';
import { Loader, PageHero, ProductCard, Reveal } from '../components/ui';

const SORTS = {
  featured: { label: 'Featured', fn: (a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99) },
  'price-asc': { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
  name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
};

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const category = params.get('category') || '';
  const sub = params.get('sub') || '';
  const [tree, setTree] = useState(null);
  const sort = params.get('sort') || 'featured';
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/api/products').then((d) => setProducts(d.products)).catch((e) => setError(e.message));
    // admin-managed categories (order + subcategories); falls back to the built-in list if unavailable
    api.get('/api/categories', { auth: null }).then((d) => setTree(d.categories)).catch(() => setTree([]));
  }, []);

  // only show categories that currently have products, in the order set in the admin panel
  const cats = useMemo(() => {
    const present = new Set((products || []).map((p) => p.category));
    const order = tree?.length ? tree.map((c) => c.name) : CATEGORIES;
    const ordered = order.filter((c) => present.has(c));
    return [...ordered, ...[...present].filter((c) => !order.includes(c))];
  }, [products, tree]);

  const subs = useMemo(() => {
    const present = new Set((products || []).filter((p) => p.category === category).map((p) => p.subcategory).filter(Boolean));
    return ((tree || []).find((c) => c.name === category)?.subcategories || []).filter((s) => present.has(s.name));
  }, [tree, products, category]);

  const list = useMemo(() => {
    if (!products) return [];
    return products
      .filter((p) => !category || p.category === category)
      .filter((p) => !sub || p.subcategory === sub)
      .filter((p) => !q || `${p.name} ${p.subtitle} ${p.category} ${p.subcategory || ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort(SORTS[sort]?.fn || SORTS.featured.fn);
  }, [products, category, sub, sort, q]);

  const pickCategory = (c) => {
    const next = new URLSearchParams(params);
    c ? next.set('category', c) : next.delete('category');
    next.delete('sub');
    setParams(next, { replace: true });
  };

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHero eyebrow="Shop" title="The Quench Elegance Collection" subtitle="Botanical oils, active-infused serums, scalp care and gentle cleansers — thoughtfully formulated for everyday hair and scalp care." />
      <section className="section section-tight">
        <div className="container">
          <div className="shop-toolbar">
            <div className="chips" role="tablist" aria-label="Categories">
              <button className={`chip ${!category ? 'active' : ''}`} onClick={() => pickCategory('')}>All</button>
              {cats.map((c) => (
                <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => pickCategory(c)}>{c}</button>
              ))}
            </div>
            <div className="shop-tools">
              <label className="search-box">
                <Search size={16} />
                <input placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
              </label>
              <select className="select" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
                {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
            </div>
          </div>
          {category && subs.length > 0 && (
            <div className="subchips" role="tablist" aria-label={`${category} types`}>
              <span className="subchips-label">{category}</span>
              <button className={`subchip ${!sub ? 'active' : ''}`} onClick={() => set('sub', '')}>All</button>
              {subs.map((s) => (
                <button key={s.id} className={`subchip ${sub === s.name ? 'active' : ''}`} onClick={() => set('sub', s.name)}>{s.name}</button>
              ))}
            </div>
          )}
          {error && <div className="alert alert-error">{error}</div>}
          {!products && !error ? (
            <Loader />
          ) : list.length === 0 ? (
            <div className="empty-state"><h3>No products found</h3><p>Try a different category or search term.</p></div>
          ) : (
            <div className="product-grid">
              {list.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 70}><ProductCard product={p} /></Reveal>)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
