import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Gift, Pencil, Plus, Star } from 'lucide-react';
import { api } from '../lib/api';
import { inr, SITE_URL } from '../lib/format';
import { EmptyState, PageHeader, PageLoader } from '../components/ui';
import { useToast } from '../components/feedback';

export default function Combos() {
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState(null);

  useEffect(() => { api.get('/combos').then((d) => setList(d.combos)).catch((e) => { toast(e.message, 'error'); setList([]); }); }, [toast]);

  const toggleActive = async (c) => {
    try {
      const d = await api.put(`/combos/${c.id}`, { active: !c.active });
      setList((l) => l.map((x) => (x.id === c.id ? d.combo : x)));
      toast(d.combo.active ? `${c.name} is now on the website` : `${c.name} hidden from the website`);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Combos"
        subtitle="Kits of your products sold at one offer price. Featured combos appear on the website home page; each has its own page."
        actions={<Link to="/combos/new" className="btn-primary"><Plus size={16} /> New combo</Link>}
      />

      <div className="card overflow-hidden">
        {!list ? <PageLoader /> : list.length === 0 ? (
          <EmptyState icon={Gift} title="No combos yet" action={<Link to="/combos/new" className="btn-primary"><Plus size={16} /> Create the first combo</Link>}>
            Bundle products into a kit — e.g. shampoo + serum + elixir — with a special price.
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>Combo</th>
                    <th>Products in the kit</th>
                    <th className="text-right">Price</th>
                    <th>Stock</th>
                    <th className="text-center">Home page</th>
                    <th>Website</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className={`cursor-pointer ${c.active ? '' : 'opacity-70'}`} onClick={() => navigate(`/combos/${c.id}`)}>
                      <td className="font-display text-lg text-bronze tabular-nums">{c.sortOrder}</td>
                      <td>
                        <div className="flex min-w-60 items-center gap-3">
                          <span className="block h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-silver-100">
                            {(c.image || c.banner) ? <img src={c.image || c.banner} alt="" className="size-full object-cover" /> : <Gift size={20} className="m-auto mt-4 text-silver-400" />}
                          </span>
                          <span className="min-w-0">
                            <Link to={`/combos/${c.id}`} onClick={(e) => e.stopPropagation()} className="block font-display text-xl font-semibold leading-tight tracking-wide hover:text-brown-800">{c.name}</Link>
                            <span className="block max-w-60 truncate text-xs text-muted">{c.tagline}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex max-w-80 flex-wrap gap-1">
                          {c.items.map((i) => (
                            <span key={i.productId} className="whitespace-nowrap rounded-full bg-cream/80 px-2 py-0.5 text-[11px] text-brown-800">{i.name} <b>×{i.qty}</b></span>
                          ))}
                          {!c.items.length && <span className="text-xs text-danger">No products</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <div className="font-medium tabular-nums">{inr(c.price)}</div>
                        {c.savingsPercent > 0 && <div className="text-xs text-muted"><span className="line-through">{inr(c.mrp)}</span> <span className="font-medium text-success">{c.savingsPercent}% off</span></div>}
                      </td>
                      <td>
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${c.available === 0 ? 'bg-[#f5e0de] text-danger' : c.available <= 5 ? 'bg-[#efe6d6] text-warning' : 'bg-silver-200 text-ink-2'}`}>
                          {c.available === 0 ? 'Out of stock' : `${c.available} kits`}
                        </span>
                        {c.hiddenItems?.length > 0 && <div className="mt-1 text-[11px] text-warning" title={c.hiddenItems.join(', ')}>Has a hidden product</div>}
                      </td>
                      <td className="text-center">{c.featured ? <Star size={16} className="mx-auto fill-gold text-gold" aria-label="Featured" /> : <span className="text-silver-400">—</span>}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" role="switch" aria-checked={c.active} onClick={() => toggleActive(c)} className="flex items-center gap-2 text-xs font-medium" title={c.active ? 'Hide from website' : 'Show on website'}>
                          <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${c.active ? 'bg-brown-800' : 'bg-silver-300'}`}>
                            <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${c.active ? 'left-[18px]' : 'left-0.5'}`} />
                          </span>
                          <span className={c.active ? 'text-success' : 'text-muted'}>{c.active ? 'Visible' : 'Hidden'}</span>
                        </button>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link to={`/combos/${c.id}`} className="icon-btn !size-8" title="Edit" aria-label={`Edit ${c.name}`}><Pencil size={15} /></Link>
                          {c.active && <a href={`${SITE_URL}/combo/${c.slug}`} target="_blank" rel="noreferrer" className="icon-btn !size-8" title="View on website" aria-label={`View ${c.name} on website`}><ExternalLink size={15} /></a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-silver-200/80 bg-silver-50/60 px-4 py-2.5 text-xs text-muted">
              Kit stock is worked out from the products inside — buying a kit takes stock from each of them.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
