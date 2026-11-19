import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, EyeOff, FolderTree, Layers, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { ActivePill, Alert, EmptyState, Field, PageHeader, PageLoader, Toggle } from '../components/ui';
import { Modal, useConfirm, useToast } from '../components/feedback';

/** Add / edit dialog for a main category or a subcategory. */
function CategoryModal({ initial, parent, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const isSub = !!(parent || initial?.parentId);
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '', active: initial?.active ?? true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const d = editing
        ? await api.put(`/categories/${initial.id}`, form)
        : await api.post('/categories', { ...form, parentId: parent?.id || null });
      toast(editing ? 'Category updated' : `${isSub ? 'Subcategory' : 'Category'} “${d.category.name}” added`);
      onSaved(d.categories, d.category);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const kind = isSub ? 'subcategory' : 'main category';
  return (
    <Modal
      title={editing ? `Edit ${kind}` : `Add ${kind}`}
      subtitle={isSub ? <>Under <strong className="text-ink-2">{parent?.name || initial?.parentName}</strong></> : 'Main categories appear as filters on the website shop.'}
      onClose={onClose}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name *">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isSub ? 'e.g. Anti-hair fall' : 'e.g. Hair Oil'} required autoFocus maxLength={80} />
        </Field>
        <Field label="Description" hint="Optional — a short line for your team.">
          <textarea className="input !min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} />
        </Field>
        <div className="border-t border-silver-200 pt-2">
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Show on website" description="Hidden categories stay in the admin but aren't offered as shop filters." />
        </div>
        {editing && initial.products > 0 && form.name.trim() !== initial.name && (
          <Alert type="info">Renaming updates the {initial.products} product{initial.products > 1 ? 's' : ''} in this {kind}.</Alert>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : `Add ${isSub ? 'subcategory' : 'category'}`}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  const toast = useToast();
  const confirm = useConfirm();
  const [cats, setCats] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // {initial?, parent?}
  const [busy, setBusy] = useState(false);

  const apply = (list, pick) => {
    setCats(list);
    setSelectedId((cur) => pick || (list.some((c) => c.id === cur) ? cur : list[0]?.id || null));
  };
  useEffect(() => { api.get('/categories').then((d) => apply(d.categories)).catch((e) => setError(e.message)); }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!cats) return <PageLoader />;

  const selected = cats.find((c) => c.id === selectedId);
  const totalSubs = cats.reduce((s, c) => s + c.subcategories.length, 0);

  /** Swap a category with its neighbour and save the new order for every sibling that moved. */
  const move = async (list, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length || busy) return;
    const order = [...list];
    [order[i], order[j]] = [order[j], order[i]];
    setBusy(true);
    try {
      let latest;
      for (let k = 0; k < order.length; k++) {
        if (order[k].sortOrder !== k + 1) latest = await api.put(`/categories/${order[k].id}`, { sortOrder: k + 1 });
      }
      if (latest) apply(latest.categories);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const toggleActive = async (c) => {
    try {
      const d = await api.put(`/categories/${c.id}`, { active: !c.active });
      apply(d.categories);
      toast(c.active ? `“${c.name}” hidden from the website` : `“${c.name}” is visible on the website`);
    } catch (e) { toast(e.message, 'error'); }
  };

  const remove = async (c, isSub) => {
    const ok = await confirm({
      title: `Delete “${c.name}”?`,
      body: isSub ? 'This subcategory will be removed.' : 'This main category will be removed.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const d = await api.del(`/categories/${c.id}`);
      apply(d.categories);
      toast(d.message);
    } catch (e) { toast(e.message, 'error'); }
  };

  const RowActions = ({ c, list, i, isSub }) => (
    <div className="flex items-center justify-end gap-0.5">
      <button className="icon-btn !size-8" onClick={() => move(list, i, -1)} disabled={i === 0 || busy} title="Move up" aria-label="Move up"><ArrowUp size={15} /></button>
      <button className="icon-btn !size-8" onClick={() => move(list, i, 1)} disabled={i === list.length - 1 || busy} title="Move down" aria-label="Move down"><ArrowDown size={15} /></button>
      <button className="icon-btn !size-8" onClick={() => toggleActive(c)} title={c.active ? 'Hide from website' : 'Show on website'} aria-label={c.active ? 'Hide from website' : 'Show on website'}>
        {c.active ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
      <button className="icon-btn !size-8" onClick={() => setModal({ initial: { ...c, parentName: isSub ? selected?.name : undefined } })} title="Edit" aria-label={`Edit ${c.name}`}><Pencil size={15} /></button>
      <button className="icon-btn !size-8 hover:!bg-danger/10 hover:text-danger" onClick={() => remove(c, isSub)} title="Delete" aria-label={`Delete ${c.name}`}><Trash2 size={15} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        subtitle="Organise products into main categories and subcategories. Products pick them on the product page; the website shop uses them as filters."
        actions={<button className="btn-primary" onClick={() => setModal({})}><Plus size={16} /> Main category</button>}
      />

      <div className="mb-5 grid grid-cols-3 gap-3 sm:max-w-xl">
        {[[FolderTree, 'Main categories', cats.length], [Layers, 'Subcategories', totalSubs], [Package, 'Products', cats.reduce((s, c) => s + c.products, 0)]].map(([Icon, label, value]) => (
          <div key={label} className="card flex items-center gap-3 px-4 py-3">
            <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-cream text-brown-800 sm:grid"><Icon size={17} /></span>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-semibold leading-none">{value}</span>
              <span className="block truncate text-xs text-muted">{label}</span>
            </span>
          </div>
        ))}
      </div>

      {cats.length === 0 ? (
        <div className="card">
          <EmptyState icon={FolderTree} title="No categories yet" action={<button className="btn-primary" onClick={() => setModal({})}><Plus size={16} /> Add main category</button>}>
            Start with a main category such as “Hair Oil”, then add subcategories under it.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Main categories */}
          <section className="card self-start overflow-hidden">
            <div className="flex items-center justify-between border-b border-silver-200/80 px-5 py-4">
              <h2 className="card-title">Main categories</h2>
              <span className="text-xs text-muted">{cats.length} total</span>
            </div>
            <ul className="divide-y divide-silver-200/70">
              {cats.map((c, i) => (
                <li key={c.id}>
                  <div className={`group relative flex items-center gap-3 px-4 py-3 transition ${c.id === selectedId ? 'bg-cream/50' : 'hover:bg-white/70'}`}>
                    {c.id === selectedId && <span className="absolute inset-y-0 left-0 w-1 bg-gold" />}
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelectedId(c.id)}>
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-lg font-semibold ${c.id === selectedId ? 'bg-brown-800 text-gold-soft' : 'bg-cream text-brown-800'}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate font-medium ${c.active ? '' : 'text-muted line-through decoration-1'}`}>{c.name}</span>
                        <span className="block text-xs text-muted">
                          {c.subcategories.length} sub{c.subcategories.length === 1 ? 'category' : 'categories'} · {c.products} product{c.products === 1 ? '' : 's'}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button className="icon-btn !size-7" onClick={() => move(cats, i, -1)} disabled={i === 0 || busy} aria-label={`Move ${c.name} up`}><ArrowUp size={14} /></button>
                      <button className="icon-btn !size-7" onClick={() => move(cats, i, 1)} disabled={i === cats.length - 1 || busy} aria-label={`Move ${c.name} down`}><ArrowDown size={14} /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button onClick={() => setModal({})} className="flex w-full items-center justify-center gap-2 border-t border-dashed border-silver-300 px-4 py-3.5 text-sm font-medium text-brown-700 transition hover:bg-cream/40">
              <Plus size={16} /> Add main category
            </button>
          </section>

          {/* Selected category + its subcategories */}
          {selected && (
            <section className="card min-w-0 self-start overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-silver-200/80 p-5 sm:p-6">
                <div className="min-w-0">
                  <p className="eyebrow mb-1">Main category</p>
                  <h2 className="flex flex-wrap items-center gap-3 text-3xl">{selected.name} <span className="font-sans tracking-normal"><ActivePill active={selected.active} on="On website" off="Hidden" /></span></h2>
                  {selected.description && <p className="mt-1.5 text-sm text-muted">{selected.description}</p>}
                  <Link to={`/products?category=${encodeURIComponent(selected.name)}`} className="link mt-2 inline-block text-sm">
                    {selected.products} product{selected.products === 1 ? '' : 's'} in this category →
                  </Link>
                </div>
                <div className="flex gap-2">
                  <button className="btn-outline btn-sm" onClick={() => setModal({ initial: selected })}><Pencil size={14} /> Edit</button>
                  <button className="btn-danger btn-sm" onClick={() => remove(selected, false)}><Trash2 size={14} /> Delete</button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
                <div>
                  <h3 className="font-display text-xl font-semibold">Subcategories</h3>
                  <p className="text-xs text-muted">Optional finer groups inside {selected.name}.</p>
                </div>
                <button className="btn-primary btn-sm" onClick={() => setModal({ parent: selected })}><Plus size={14} /> Add subcategory</button>
              </div>

              {selected.subcategories.length === 0 ? (
                <div className="mx-5 mb-6 rounded-2xl border border-dashed border-silver-300 px-6 py-10 text-center sm:mx-6">
                  <Layers size={22} className="mx-auto text-bronze" />
                  <p className="mt-2 font-medium">No subcategories yet</p>
                  <p className="mt-1 text-sm text-muted">e.g. under “Hair Oil”: Anti-hair fall, Nourishing, Kids.</p>
                  <button className="btn-outline btn-sm mt-4" onClick={() => setModal({ parent: selected })}><Plus size={14} /> Add the first one</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead><tr><th>#</th><th>Subcategory</th><th className="text-right">Products</th><th>Website</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>
                      {selected.subcategories.map((s, i) => (
                        <tr key={s.id}>
                          <td className="w-10 font-display text-lg text-bronze">{i + 1}</td>
                          <td>
                            <div className="font-medium">{s.name}</div>
                            {s.description && <div className="max-w-xs truncate text-xs text-muted">{s.description}</div>}
                          </td>
                          <td className="text-right tabular-nums">{s.products}</td>
                          <td><ActivePill active={s.active} on="Visible" off="Hidden" /></td>
                          <td><RowActions c={s} list={selected.subcategories} i={i} isSub /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {modal && (
        <CategoryModal
          initial={modal.initial}
          parent={modal.parent}
          onClose={() => setModal(null)}
          onSaved={(list, saved) => { apply(list, saved && !saved.parentId ? saved.id : undefined); setModal(null); }}
        />
      )}
    </div>
  );
}
