import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Loader2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { initials } from '../lib/format';
import { useToast } from './feedback';

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin text-brown-700 ${className}`} size={26} />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner />
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, back, actions }) {
  return (
    <div className="mb-6 animate-fade-up">
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-brown-800 no-print">
          <ArrowLeft size={15} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="text-[34px] leading-none sm:text-[40px]">{title}</h1>
          {subtitle && <div className="mt-2 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  Placed: 'bg-[#efe6d6] text-[#7a4f12]',
  Confirmed: 'bg-[#e2e8f3] text-[#23457a]',
  Packed: 'bg-[#ece4f3] text-[#5a2f7a]',
  Shipped: 'bg-[#dfeef0] text-[#1d5f66]',
  Delivered: 'bg-[#e0efe2] text-[#2f6b3a]',
  Cancelled: 'bg-[#f5e0de] text-[#a3261b]',
  Paid: 'bg-[#e0efe2] text-[#2f6b3a]',
  Pending: 'bg-[#efe6d6] text-[#7a4f12]',
  Refunded: 'bg-[#e2e8f3] text-[#23457a]',
  pending: 'bg-[#efe6d6] text-[#7a4f12]',
  approved: 'bg-[#e0efe2] text-[#2f6b3a]',
  rejected: 'bg-[#f5e0de] text-[#a3261b]',
};
export const STATUS_DOT = {
  Placed: '#b07a2a', Confirmed: '#3a64a8', Packed: '#7c4fa3', Shipped: '#2a8a94', Delivered: '#3f8a4c', Cancelled: '#b8392c',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${STATUS_STYLES[status] || 'bg-silver-200 text-ink-2'}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export function ActivePill({ active, on = 'Active', off = 'Inactive' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-[#e0efe2] text-success' : 'bg-silver-200 text-muted'}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {active ? on : off}
    </span>
  );
}

export function Avatar({ name, className = 'size-9 text-xs' }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-linear-to-br from-brown-700 to-brown-900 font-semibold tracking-wide text-gold-soft ${className}`}>
      {initials(name)}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <label className={`relative block ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-silver-500" />
      <input className="input rounded-full pl-10" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search" />
    </label>
  );
}

export function Field({ label, hint, className = '', children }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-ink-2">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-silver-300 transition peer-checked:bg-brown-800 peer-focus-visible:ring-2 peer-focus-visible:ring-bronze" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-cream text-brown-700">
          <Icon size={24} />
        </span>
      )}
      <h3 className="text-2xl">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  const styles = {
    error: 'border-[#efc6c0] bg-[#f8e3e0] text-danger',
    info: 'border-[#e3d0ab] bg-[#f3ead9] text-brown-800',
    success: 'border-[#c3dcc6] bg-[#e2efe3] text-success',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>{children}</div>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} className={`chip shrink-0 ${value === t.value ? 'chip-active' : ''}`}>
          {t.label}
          {t.count != null && (
            <span className={`rounded-full px-1.5 text-[11px] ${value === t.value ? 'bg-white/20' : 'bg-silver-200 text-muted'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ImageUpload({ value, onChange, label = 'Upload image', className = 'aspect-square' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const d = await api.upload(f);
      onChange(d.url);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };
  return (
    <label
      className={`group relative grid cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition ${value ? 'border-transparent bg-silver-100' : 'border-silver-300 bg-white/60 hover:border-bronze hover:bg-cream/40'} ${className}`}
    >
      {value ? (
        <>
          <img src={value} alt="" className="size-full object-contain" />
          <span className="absolute inset-0 grid place-items-center bg-brown-950/50 text-sm font-medium text-white opacity-0 transition group-hover:opacity-100">
            {busy ? 'Uploading…' : 'Replace'}
          </span>
        </>
      ) : (
        <span className="flex flex-col items-center gap-1.5 p-3 text-center text-xs font-medium text-muted">
          {busy ? <Spinner className="!size-5" /> : <ImagePlus size={22} className="text-bronze" />}
          {busy ? 'Uploading…' : label}
        </span>
      )}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={pick} hidden disabled={busy} />
    </label>
  );
}
