import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ClipboardList, Stethoscope } from 'lucide-react';
import { api } from '../lib/api';

/* The form definition comes from the backend (app/consultation.py) — loaded once and shared. */
let formCache = null;
let productCache = null;
export function useConsultationForm() {
  const [form, setForm] = useState(formCache);
  const [products, setProducts] = useState(productCache);
  useEffect(() => {
    if (!formCache) api.get('/consultation-form').then((d) => { formCache = d.sections; setForm(d.sections); }).catch(() => setForm([]));
    if (!productCache) api.get('/products').then((d) => { productCache = d.products.filter((p) => p.active).map((p) => p.name); setProducts(productCache); }).catch(() => setProducts([]));
  }, []);
  return { form, products };
}

const isBlank = (v) => v == null || v === '' || v === false || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

/* ---------------- Referral flags ---------------- */
export function ReferralFlags({ flags }) {
  if (!flags?.length) return null;
  return (
    <div className="flex gap-3 rounded-2xl border border-[#efc6c0] bg-[#f8e3e0] p-4 text-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/10 text-danger"><Stethoscope size={18} /></span>
      <div>
        <p className="font-medium text-danger">Dermatologist referral suggested</p>
        <p className="mt-0.5 text-ink-2">{flags.join(' · ')}</p>
        <p className="mt-1 text-xs text-muted">Per Quench Elegance guidelines: refer sudden, severe or patchy hair loss and scalp inflammation. Don't promise regrowth.</p>
      </div>
    </div>
  );
}

export function FlagIcon({ flags }) {
  if (!flags?.length) return null;
  return (
    <span title={`Referral suggested: ${flags.join(', ')}`} className="inline-grid size-6 place-items-center rounded-full bg-[#f5e0de] text-danger">
      <AlertTriangle size={13} />
    </span>
  );
}

export function ConcernChips({ concerns = [], max = 3 }) {
  if (!concerns.length) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {concerns.slice(0, max).map((c) => <span key={c} className="whitespace-nowrap rounded-full bg-cream/80 px-2 py-0.5 text-[11px] text-brown-800">{c}</span>)}
      {concerns.length > max && <span className="rounded-full bg-silver-200 px-2 py-0.5 text-[11px] text-muted">+{concerns.length - max}</span>}
    </span>
  );
}

/* ---------------- Read-only answers ---------------- */
function Answer({ field, values }) {
  const v = values[field.id];
  if (field.type === 'consent') {
    return (
      <li className="flex gap-2.5 text-sm">
        <span className={`mt-0.5 grid size-4.5 shrink-0 place-items-center rounded ${v ? 'bg-success text-white' : 'bg-silver-200'}`}>{v && <Check size={11} strokeWidth={3} />}</span>
        <span className={v ? 'text-ink-2' : 'text-muted line-through'}>{field.label}</span>
      </li>
    );
  }
  let shown;
  if (isBlank(v)) shown = <span className="text-silver-500">Not answered</span>;
  else if (Array.isArray(v)) shown = <span className="flex flex-wrap gap-1.5">{v.map((x) => <span key={x} className="rounded-full border border-brown-800/15 bg-white px-2.5 py-0.5 text-[13px]">{x === 'Other' && values[`${field.id}Other`] ? `Other: ${values[`${field.id}Other`]}` : x}</span>)}</span>;
  else if (field.type === 'progress') shown = <ProgressTable field={field} value={v} readOnly />;
  else shown = <span className="whitespace-pre-line font-medium text-ink">{v === 'Other' && values[`${field.id}Other`] ? `Other: ${values[`${field.id}Other`]}` : v}</span>;
  const fu = field.followUp && v === field.followUp.when && values[field.followUp.id];
  return (
    <li className={`grid gap-1 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4 ${field.type === 'progress' ? 'sm:grid-cols-1' : ''}`}>
      <span className="text-sm text-muted">{field.label}</span>
      <span className="text-sm">{shown}{fu && <span className="mt-1 block text-[13px] text-ink-2">↳ {fu}</span>}</span>
    </li>
  );
}

export function SectionCard({ section, children, tag, defaultOpen = true, muted = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`card overflow-hidden ${muted ? 'opacity-75' : ''}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6">
        <span className="w-9 shrink-0 font-display text-3xl font-semibold leading-none text-bronze/80 tabular-nums">{section.number ? String(section.number).padStart(2, '0') : <ClipboardList size={22} className="text-bronze/80" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-semibold leading-tight">{section.title}</span>
          {section.subtitle && <span className="block truncate text-xs text-muted">{section.subtitle}</span>}
        </span>
        {tag}
        <ChevronDown size={18} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-silver-200/80 px-5 pb-5 pt-2 sm:px-6">{children}</div>}
    </section>
  );
}

export function ConsultationAnswers({ form, consultation }) {
  if (!consultation?.answers) {
    return (
      <div className="card card-pad flex items-center gap-4 text-sm text-muted">
        <ClipboardList size={22} className="text-bronze" />
        No client consultation on record — this customer was added directly by an admin.
      </div>
    );
  }
  const { answers, skipped = [] } = consultation;
  const clientSections = form.filter((s) => s.audience === 'client');
  return (
    <div className="space-y-3">
      {clientSections.map((s) => {
        const isSkipped = skipped.includes(s.id) || !answers[s.id];
        const notApplicable = s.condition && skipped.includes(s.id) && s.id === 'womens' && answers.personal?.gender === 'Male';
        const tag = isSkipped ? (
          <span className="rounded-full bg-silver-200 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">{notApplicable ? 'Not applicable' : 'Skipped'}</span>
        ) : s.required ? (
          <span className="rounded-full bg-brown-800 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-gold-soft">Required</span>
        ) : null;
        return (
          <SectionCard key={s.id} section={s} tag={tag} defaultOpen={!isSkipped} muted={isSkipped}>
            {isSkipped ? (
              <p className="py-2 text-sm text-muted">The client {notApplicable ? 'did not need' : 'chose to skip'} this section.</p>
            ) : (
              <ul className={s.id === 'declaration' ? 'space-y-2.5 pt-2' : 'divide-y divide-silver-200/70'}>
                {s.fields.map((f) => <Answer key={f.id} field={f} values={answers[s.id] || {}} />)}
              </ul>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

/* ---------------- Consultant editor (details, 11, 12, 13) ---------------- */
function ProgressTable({ field, value = {}, onChange, readOnly }) {
  const set = (row, col, v) => onChange({ ...value, [row]: { ...(value[row] || {}), [col]: v } });
  return (
    <div className="overflow-x-auto rounded-xl border border-silver-200">
      <table className="w-full text-sm">
        <thead className="bg-silver-50 text-[11px] uppercase tracking-[.12em] text-muted">
          <tr><th className="px-3 py-2 text-left font-semibold">Parameter</th><th className="px-3 py-2 text-left font-semibold">Initial</th><th className="px-3 py-2 text-left font-semibold">Follow-up</th></tr>
        </thead>
        <tbody>
          {field.rows.map((row) => (
            <tr key={row} className="border-t border-silver-200/70">
              <td className="whitespace-nowrap px-3 py-2 text-ink-2">{row}</td>
              {['initial', 'followUp'].map((col) => (
                <td key={col} className="px-2 py-1.5">
                  {readOnly ? <span>{value[row]?.[col] || <span className="text-silver-500">—</span>}</span> : (
                    <input className="input !rounded-lg !py-1.5" value={value[row]?.[col] || ''} onChange={(e) => set(row, col, e.target.value)} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditorField({ field, values, set, products }) {
  const v = values[field.id];
  const label = <span className="label">{field.label}</span>;
  if (['text', 'date', 'number', 'email', 'tel'].includes(field.type)) {
    return <div className={field.half ? '' : 'sm:col-span-2'}>{label}<input type={field.type} className="input" value={v || ''} onChange={(e) => set(field.id, e.target.value)} /></div>;
  }
  if (field.type === 'textarea') {
    return <div className="sm:col-span-2">{label}<textarea className="input !min-h-24" value={v || ''} onChange={(e) => set(field.id, e.target.value)} /></div>;
  }
  if (field.type === 'single') {
    return (
      <div className={field.half ? '' : 'sm:col-span-2'}>
        {label}
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((o) => (
            <button type="button" key={o} onClick={() => set(field.id, v === o ? '' : o)} className={`chip !py-1 ${v === o ? 'chip-active' : ''}`}>{o}</button>
          ))}
        </div>
      </div>
    );
  }
  if (field.type === 'multi' || field.type === 'products') {
    const options = field.type === 'products' ? (products || []) : field.options;
    const list = Array.isArray(v) ? v : [];
    const toggle = (o) => set(field.id, list.includes(o) ? list.filter((x) => x !== o) : [...list, o]);
    return (
      <div className="sm:col-span-2">
        {label}
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button type="button" key={o} onClick={() => toggle(o)} className={`chip !py-1 ${list.includes(o) ? 'chip-active' : ''}`}>
              {list.includes(o) && <Check size={13} />}{o}
            </button>
          ))}
          {field.type === 'products' && !options.length && <span className="text-sm text-muted">No active products.</span>}
        </div>
      </div>
    );
  }
  if (field.type === 'progress') {
    return <div className="sm:col-span-2">{label}<ProgressTable field={field} value={v || {}} onChange={(val) => set(field.id, val)} /></div>;
  }
  return null;
}

/** Editable consultant sections. value = {sectionId: {fieldId: value}} */
export function ConsultantEditor({ form, products, value, onChange }) {
  const sections = form.filter((s) => s.audience === 'consultant');
  return (
    <div className="space-y-3">
      {sections.map((s) => {
        const vals = value[s.id] || {};
        const set = (fid, v) => onChange({ ...value, [s.id]: { ...vals, [fid]: v } });
        const filled = Object.values(vals).some((x) => !isBlank(x));
        return (
          <SectionCard
            key={s.id}
            section={s}
            defaultOpen={s.id !== 'followup' || filled}
            tag={<span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${filled ? 'bg-[#e0efe2] text-success' : 'bg-cream text-brown-800'}`}>{filled ? 'Filled' : 'Consultant'}</span>}
          >
            <div className="grid gap-4 pt-3 sm:grid-cols-2">
              {s.fields.map((f) => <EditorField key={f.id} field={f} values={vals} set={set} products={products} />)}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
