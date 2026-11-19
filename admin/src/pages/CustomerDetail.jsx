import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClipboardList, Mail, Plus, MapPin, MessageCircle, MessagesSquare, Pencil, Phone, Power, Printer, Save, ShoppingBag, Trash2, User } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate, inr, timeAgo } from '../lib/format';
import { ActivePill, Alert, Avatar, EmptyState, PageHeader, PageLoader, StatusBadge } from '../components/ui';
import { ConcernChips, ConsultantEditor, ConsultationAnswers, ReferralFlags, useConsultationForm } from '../components/Consultation';
import { useConfirm, useToast } from '../components/feedback';
import { CustomerModal } from './Customers';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'consultation' ? 'consultation' : 'overview';
  const setTab = (t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const { form, products } = useConsultationForm();
  const [consultant, setConsultant] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api.get(`/customers/${id}`).then((d) => {
    setData(d);
    setConsultant(d.customer.consultation?.consultant || {});
    setDirty(false);
  }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageLoader />;
  const { customer: c, orders, flags } = data;
  const cons = c.consultation;
  const personal = cons?.answers?.personal || {};
  const concerns = cons?.answers?.concerns || {};

  const saveConsultation = async () => {
    setSaving(true);
    try {
      await api.put(`/customers/${id}/consultation`, { consultant });
      toast('Consultation record saved');
      load();
    } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
  };
  const spent = orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);

  const toggle = async () => {
    if (c.active) {
      const ok = await confirm({ title: `Deactivate ${c.name}?`, body: 'They will no longer be able to log in or place orders until reactivated.', confirmLabel: 'Deactivate', danger: true });
      if (!ok) return;
    }
    try {
      await api.put(`/customers/${id}`, { active: !c.active });
      toast(c.active ? 'Customer deactivated' : 'Customer activated');
      load();
    } catch (e) { toast(e.message, 'error'); }
  };
  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      body: orders.length ? 'This customer has orders, so the account will be deactivated instead of deleted.' : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const d = await api.del(`/customers/${id}`);
      toast(d.message);
      if (d.deactivated) load(); else navigate('/customers');
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <PageHeader
        back={{ to: '/customers', label: 'Customers' }}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={c.name} className="size-14 text-lg" />
            <span>{c.name}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            User ID <strong className="text-ink-2">{c.customerCode}</strong> · <ActivePill active={c.active} />
            {(personal.age || personal.gender) && <span>· {[personal.age && `${personal.age} yrs`, personal.gender, personal.city].filter(Boolean).join(' · ')}</span>}
          </span>
        }
        actions={
          <>
            <Link className="btn-primary" to={`/chats/${c.id}`}><MessagesSquare size={15} /> Chat</Link>
            {c.active && <Link className="btn-outline" to={`/orders/new?customer=${c.id}`}><Plus size={15} /> Create order</Link>}
            <button className="btn-outline" onClick={() => setEdit(true)}><Pencil size={15} /> Edit</button>
            <button className="btn-outline" onClick={toggle}><Power size={15} /> {c.active ? 'Deactivate' : 'Activate'}</button>
            <button className="btn-danger" onClick={remove}><Trash2 size={15} /> Delete</button>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-1 border-b border-silver-300/70 no-print">
        {[['overview', 'Overview', User], ['consultation', 'Consultation', ClipboardList]].map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === key ? 'border-brown-800 text-brown-800' : 'border-transparent text-muted hover:text-ink'}`}>
            <Icon size={16} /> {label}
            {key === 'consultation' && flags?.length > 0 && <span className="size-2 rounded-full bg-danger" title="Referral suggested" />}
          </button>
        ))}
      </div>

      {tab === 'consultation' ? (
        !form ? <PageLoader /> : (
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-5">
              <ReferralFlags flags={flags} />
              <div>
                <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 text-2xl">Consultant record <span className="font-sans text-xs font-normal text-muted">Details · Assessment · Recommendation · Follow-up</span></h2>
                <ConsultantEditor form={form} products={products} value={consultant} onChange={(v) => { setConsultant(v); setDirty(true); }} />
              </div>
              <div>
                <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 text-2xl">Client answers <span className="font-sans text-xs font-normal text-muted">Submitted {cons?.submittedAt ? fmtDate(cons.submittedAt, true) : '—'}</span></h2>
                <ConsultationAnswers form={form} consultation={cons} />
              </div>
            </div>
            <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start no-print">
              <section className="card card-pad space-y-3">
                <h2 className="card-title">Consultation</h2>
                <p className="text-sm text-muted">
                  {cons?.consultantUpdatedAt
                    ? <>Last saved {fmtDate(cons.consultantUpdatedAt, true)}{cons.consultantUpdatedBy ? ` by ${cons.consultantUpdatedBy}` : ''}.</>
                    : cons?.approvedAt ? <>Approved {fmtDate(cons.approvedAt, true)}{cons.approvedBy ? ` by ${cons.approvedBy}` : ''}.</> : 'Not saved yet.'}
                </p>
                {dirty && <p className="text-sm text-warning">You have unsaved changes.</p>}
                <button className="btn-primary w-full" onClick={saveConsultation} disabled={saving || !dirty}><Save size={15} /> {saving ? 'Saving…' : 'Save consultant record'}</button>
                <button className="btn-outline w-full" onClick={() => window.print()}><Printer size={15} /> Print consultation</button>
              </section>
              {concerns.primaryConcerns?.length > 0 && (
                <section className="card card-pad">
                  <h2 className="card-title mb-3">At a glance</h2>
                  <ConcernChips concerns={concerns.primaryConcerns} max={8} />
                  <dl className="mt-4 space-y-2 text-sm">
                    {[['Duration', concerns.duration], ['Hair fall', concerns.hairFallLevel], ['Scalp', cons.answers.scalp?.scalpType], ['Goals', cons.answers.expectations?.goals?.join(', ')]]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                      ))}
                  </dl>
                </section>
              )}
            </aside>
          </div>
        )
      ) : (<>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Orders', orders.length, `Customer since ${fmtDate(c.createdAt)}`],
          ['Total spent', inr(spent), 'Excluding cancelled orders'],
          ['Last login', c.lastLoginAt ? timeAgo(c.lastLoginAt) : 'Never', c.lastLoginAt ? fmtDate(c.lastLoginAt, true) : 'Has not logged in yet'],
        ].map(([label, value, sub]) => (
          <div key={label} className="card card-pad">
            <p className="text-[11px] font-medium uppercase tracking-[.2em] text-muted">{label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="card overflow-hidden">
          <h2 className="card-title p-5 pb-3 sm:p-6 sm:pb-3">Order history</h2>
          {orders.length === 0 ? <EmptyState icon={ShoppingBag} title="No orders yet" /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Order</th><th>Items</th><th>Status</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link className="font-medium text-brown-800 hover:underline" to={`/orders/${o.id}`}>#{o.orderNumber}</Link>
                        <div className="text-xs text-muted">{fmtDate(o.createdAt, true)}</div>
                      </td>
                      <td className="text-muted">{o.items.reduce((s, i) => s + i.qty, 0)} item(s)</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-right font-medium tabular-nums">{inr(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="card card-pad">
            <h2 className="card-title mb-3">Contact</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5"><Phone size={15} className="text-bronze" /><a href={`tel:+91${c.phone}`} className="hover:underline">+91 {c.phone}</a></li>
              {personal.whatsapp && <li className="flex items-center gap-2.5"><MessageCircle size={15} className="text-bronze" /><a href={`https://wa.me/91${personal.whatsapp}`} target="_blank" rel="noreferrer" className="hover:underline">WhatsApp +91 {personal.whatsapp}</a></li>}
              <li className="flex items-center gap-2.5"><Mail size={15} className="text-bronze" />{c.email ? <a href={`mailto:${c.email}`} className="truncate hover:underline">{c.email}</a> : <span className="text-muted">No email</span>}</li>
            </ul>
            {c.notes && (
              <>
                <h3 className="mt-5 text-[11px] font-medium uppercase tracking-[.2em] text-muted">Notes</h3>
                <p className="mt-1.5 whitespace-pre-line text-sm text-ink-2">{c.notes}</p>
              </>
            )}
          </section>
          <section className="card card-pad">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="card-title">Consultation</h2>
              <button className="link text-sm" onClick={() => setTab('consultation')}>Open →</button>
            </div>
            {cons?.answers ? (
              <>
                <ConcernChips concerns={concerns.primaryConcerns || []} max={6} />
                <p className="mt-3 text-xs text-muted">Submitted {fmtDate(cons.submittedAt)}{cons.consultant?.assessment ? ' · Assessment recorded' : ' · Assessment pending'}</p>
                {flags?.length > 0 && <p className="mt-2 text-xs font-medium text-danger">Dermatologist referral suggested</p>}
              </>
            ) : <p className="text-sm text-muted">No client consultation — added directly by an admin. You can still record an assessment.</p>}
          </section>
          <section className="card card-pad">
            <h2 className="card-title mb-3">Saved addresses</h2>
            {(c.addresses || []).length === 0 ? <p className="text-sm text-muted">No saved addresses.</p> : (
              <ul className="space-y-3">
                {c.addresses.map((a, i) => (
                  <li key={a.id || i} className="flex gap-2.5 rounded-xl bg-silver-50/80 p-3 text-sm">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-bronze" />
                    <span><strong className="font-medium">{a.name}</strong><br /><span className="text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
      </>)}
      {edit && <CustomerModal initial={c} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} />}
    </div>
  );
}
