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
  const sort = params.get('sort') || 'featured';
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/api/products').then((d) => setProducts(d.products)).catch((e) => setError(e.message));
  }, []);

  const cats = useMemo(() => {
    const present = new Set((products || []).map((p) => p.category));
    const ordered = CATEGORIES.filter((c) => present.has(c));
    return [...ordered, ...[...present].filter((c) => !CATEGORIES.includes(c))];
  }, [products]);

  const list = useMemo(() => {
    if (!products) return [];
    return products
      .filter((p) => !category || p.category === category)
      .filter((p) => !q || `${p.name} ${p.subtitle} ${p.category}`.toLowerCase().includes(q.toLowerCase()))
      .sort(SORTS[sort]?.fn || SORTS.featured.fn);
  }, [products, category, sort, q]);

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
              <button className={`chip ${!category ? 'active' : ''}`} onClick={() => set('category', '')}>All</button>
              {cats.map((c) => (
                <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => set('category', c)}>{c}</button>
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
