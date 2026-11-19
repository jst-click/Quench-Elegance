import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, ClipboardList, Download, Plus, UserCheck, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { downloadCsv, fmtDate, inr } from '../lib/format';
import { ActivePill, Alert, Avatar, EmptyState, Field, PageHeader, PageLoader, SearchInput, Tabs } from '../components/ui';
import { Modal, useToast } from '../components/feedback';
import { ConcernChips, FlagIcon } from '../components/Consultation';
import { useAuth } from '../components/auth';

export function CustomerModal({ initial, onClose, onSaved }) {
  const toast = useToast();
  const editing = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name || '', phone: initial?.phone || '', email: initial?.email || '',
    customerCode: initial?.customerCode || '', notes: initial?.notes || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const d = editing ? await api.put(`/customers/${initial.id}`, form) : await api.post('/customers', form);
      toast(editing ? 'Customer updated' : `Customer added · User ID ${d.customer.customerCode}`);
      onSaved(d.customer);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Edit customer' : 'Add customer'}
      subtitle="Only registered mobile numbers can log in with OTP and place orders."
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *" className="sm:col-span-2">
          <input className="input" value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Mobile number *">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">+91</span>
            <input className="input pl-12" inputMode="tel" maxLength={14} placeholder="10-digit mobile" value={form.phone} onChange={set('phone')} required />
          </div>
        </Field>
        <Field label="User ID" hint={editing ? undefined : 'Leave empty to auto-generate (e.g. QE1001).'}>
          <input className="input uppercase" value={form.customerCode} onChange={set('customerCode')} />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <input type="email" className="input" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Internal notes" className="sm:col-span-2">
          <textarea className="input !min-h-20" value={form.notes} onChange={set('notes')} />
        </Field>
        {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(params.get('new') ? {} : null);
  const { counts } = useAuth();

  const load = () =>
    api.get(`/customers?q=${encodeURIComponent(q)}&status=${status}`).then((d) => setList(d.customers)).catch(() => setList([]));
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    setModal(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const exportCsv = () =>
    downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, [
      { label: 'User ID', value: (c) => c.customerCode },
      { label: 'Name', value: (c) => c.name },
      { label: 'Mobile', value: (c) => c.phone },
      { label: 'Email', value: (c) => c.email },
      { label: 'Orders', value: (c) => c.orders },
      { label: 'Spent', value: (c) => c.spent },
      { label: 'Status', value: (c) => (c.active ? 'Active' : 'Inactive') },
      { label: 'Concerns', value: (c) => (c.consultation?.concerns || []).join('; ') },
      { label: 'Consultation', value: (c) => (c.consultation ? (c.consultation.hasAssessment ? 'Assessed' : 'Submitted') : '') },
      { label: 'Added', value: (c) => fmtDate(c.createdAt) },
      { label: 'Last login', value: (c) => fmtDate(c.lastLoginAt, true) },
    ], list || []);

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Customers"
        subtitle="Registered customers can log in with an OTP sent to their mobile."
        actions={
          <>
            <button className="btn-outline" onClick={exportCsv} disabled={!list?.length}><Download size={16} /> Export</button>
            <button className="btn-primary" onClick={() => setModal({})}><Plus size={16} /> Add customer</button>
          </>
        }
      />

      {list && !q && !status && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [Users, 'Customers', list.length, null],
            [UserCheck, 'Active', list.filter((c) => c.active).length, null],
            [ClipboardCheck, 'With consultation', list.filter((c) => c.consultation).length, null],
            [UserPlus, 'Awaiting approval', counts.pendingRequests || 0, '/requests'],
          ].map(([Icon, label, value, to]) => {
            const body = (
              <div className={`card flex items-center gap-3 px-4 py-3.5 ${to ? 'transition hover:shadow-card' : ''}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cream text-brown-800"><Icon size={18} /></span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl font-semibold leading-none">{value}</span>
                  <span className="block truncate text-xs text-muted">{label}</span>
                </span>
              </div>
            );
            return to ? <Link key={label} to={to}>{body}</Link> : <div key={label}>{body}</div>;
          })}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={status} onChange={setStatus} tabs={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Name, mobile, User ID, email" className="sm:w-80" />
      </div>

      <div className="card overflow-hidden">
        {!list ? <PageLoader /> : list.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q || status ? 'No matching customers' : 'No customers yet'}
            action={!q && !status && <button className="btn-primary" onClick={() => setModal({})}><Plus size={16} /> Add first customer</button>}
          >
            {q || status ? 'Try a different search.' : 'Add a customer so they can log in with OTP and order.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Customer</th><th>User ID</th><th>Mobile</th><th>Concerns</th><th>Consultation</th><th className="text-right">Orders</th><th className="text-right">Spent</th><th>Status</th></tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <Link to={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-brown-800 hover:underline">{c.name}</Link>
                          <div className="truncate text-xs text-muted">{c.email || `Added ${fmtDate(c.createdAt)}`}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="rounded-md bg-cream/70 px-2 py-0.5 font-mono text-xs text-brown-800">{c.customerCode}</span></td>
                    <td className="whitespace-nowrap">+91 {c.phone}</td>
                    <td className="min-w-40 max-w-56"><ConcernChips concerns={c.consultation?.concerns || []} max={2} /></td>
                    <td>
                      {c.consultation ? (
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${c.consultation.hasAssessment ? 'bg-[#e0efe2] text-success' : 'bg-[#efe6d6] text-warning'}`}>
                            <ClipboardList size={12} /> {c.consultation.hasAssessment ? 'Assessed' : 'Assessment due'}
                          </span>
                          <FlagIcon flags={c.consultation.flags} />
                        </span>
                      ) : <span className="text-xs text-muted">Added by admin</span>}
                    </td>
                    <td className="text-right tabular-nums">{c.orders}</td>
                    <td className="text-right font-medium tabular-nums">{inr(c.spent)}</td>
                    <td><ActivePill active={c.active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal && <CustomerModal initial={modal} onClose={close} onSaved={() => { close(); load(); }} />}
    </div>
  );
}
