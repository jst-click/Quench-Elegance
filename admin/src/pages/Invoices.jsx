import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Eye, FileText, IndianRupee, Plus, Settings2, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { downloadCsv, fmtDate, inr } from '../lib/format';
import { downloadPdf, TEMPLATES } from '../lib/invoice';
import { Alert, EmptyState, Field, PageHeader, PageLoader, SearchInput, StatusBadge, Tabs } from '../components/ui';
import { Modal, useToast } from '../components/feedback';
import InvoiceDocument from '../components/InvoiceDocument';

function SettingsModal({ onClose }) {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/invoice-settings').then((d) => setS(d.settings)).catch((e) => setError(e.message)); }, []);
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/invoice-settings', s);
      toast('Invoice settings saved');
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title="Invoice settings" subtitle="Printed on every invoice." onClose={onClose} size="lg">
      {!s ? (error ? <Alert>{error}</Alert> : <PageLoader />) : (
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name"><input className="input" value={s.businessName} onChange={set('businessName')} required /></Field>
          <Field label="Tagline"><input className="input" value={s.tagline} onChange={set('tagline')} /></Field>
          <Field label="Address" className="sm:col-span-2"><textarea className="input !min-h-16" value={s.address} onChange={set('address')} /></Field>
          <Field label="State" hint="Same state as the customer → CGST + SGST, otherwise IGST."><input className="input" value={s.state} onChange={set('state')} /></Field>
          <Field label="Phone"><input className="input" value={s.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input className="input" value={s.email} onChange={set('email')} /></Field>
          <Field label="Website"><input className="input" value={s.website} onChange={set('website')} /></Field>
          <Field label="GSTIN" hint="Leave empty if not GST registered — the invoice then says “Invoice” instead of “Tax Invoice”.">
            <input className="input uppercase" value={s.gstin} onChange={set('gstin')} maxLength={15} />
          </Field>
          <Field label="GST rate included in prices (%)" hint="0 = don't show a GST breakdown.">
            <input className="input" type="number" min="0" max="28" step="0.5" value={s.gstRate} onChange={set('gstRate')} />
          </Field>
          <Field label="Terms" className="sm:col-span-2"><textarea className="input !min-h-20" value={s.terms} onChange={set('terms')} /></Field>
          <Field label="Thank-you line"><input className="input" value={s.footer} onChange={set('footer')} /></Field>
          <Field label="Signatory"><input className="input" value={s.signatory} onChange={set('signatory')} /></Field>
          <Field label="Default design" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button type="button" key={t.id} onClick={() => setS((x) => ({ ...x, defaultTemplate: t.id }))} className={`chip ${s.defaultTemplate === t.id ? 'chip-active' : ''}`}>
                  {t.label} <span className="opacity-60">· {t.hint}</span>
                </button>
              ))}
            </div>
          </Field>
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Invoices() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('');
  const [busy, setBusy] = useState('');
  const [pdfJob, setPdfJob] = useState(null); // {order, settings, template} rendered off-screen for quick download
  const hiddenRef = useRef(null);
  const showSettings = params.get('settings') === '1';

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/invoices?q=${encodeURIComponent(q)}`).then((d) => setList(d.invoices)).catch((e) => { toast(e.message, 'error'); setList([]); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, toast]);

  // quick download straight from the list: render off-screen, export, clear
  useEffect(() => {
    if (!pdfJob) return;
    const el = hiddenRef.current?.firstElementChild;
    const run = async () => {
      try {
        await new Promise((r) => setTimeout(r, 150)); // let images load
        await downloadPdf(el, `${pdfJob.order.invoiceNumber}-${pdfJob.template}.pdf`, pdfJob.template);
        toast(`${pdfJob.order.invoiceNumber} downloaded`);
      } catch (e) { toast(`Couldn't create the PDF: ${e.message}`, 'error'); } finally { setPdfJob(null); setBusy(''); }
    };
    run();
  }, [pdfJob, toast]);

  const quickDownload = async (inv) => {
    setBusy(inv.orderId);
    try {
      const d = await api.get(`/invoices/${inv.orderId}`);
      setPdfJob({ order: d.order, settings: d.settings, template: d.settings.defaultTemplate || 'classic' });
    } catch (e) { toast(e.message, 'error'); setBusy(''); }
  };

  const filtered = useMemo(() => (list || []).filter((i) => {
    if (tab === 'paid') return i.paymentStatus === 'Paid' && i.status !== 'Cancelled';
    if (tab === 'unpaid') return i.paymentStatus !== 'Paid' && i.status !== 'Cancelled';
    if (tab === 'cancelled') return i.status === 'Cancelled';
    return true;
  }), [list, tab]);

  const live = (list || []).filter((i) => i.status !== 'Cancelled');
  const sum = (arr) => arr.reduce((s, i) => s + i.total, 0);
  const paid = live.filter((i) => i.paymentStatus === 'Paid');
  const unpaid = live.filter((i) => i.paymentStatus !== 'Paid');

  const exportCsv = () => downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: 'Invoice', value: (i) => i.invoiceNumber },
    { label: 'Date', value: (i) => fmtDate(i.invoiceDate) },
    { label: 'Order', value: (i) => i.orderNumber },
    { label: 'Customer', value: (i) => i.customer?.name },
    { label: 'User ID', value: (i) => i.customer?.customerCode },
    { label: 'Mobile', value: (i) => i.customer?.phone },
    { label: 'Amount', value: (i) => i.total },
    { label: 'Payment', value: (i) => `${i.paymentMethod} (${i.paymentStatus})` },
    { label: 'Order status', value: (i) => i.status },
  ], filtered);

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Invoices"
        subtitle="Every order gets an invoice automatically — website and admin orders alike. View it in three designs, print or download as PDF."
        actions={
          <>
            <button className="btn-outline" onClick={() => setParams({ settings: '1' })}><Settings2 size={15} /> Invoice settings</button>
            <button className="btn-outline" onClick={exportCsv} disabled={!filtered.length}><Download size={15} /> Export CSV</button>
            <Link to="/orders/new" className="btn-primary"><Plus size={15} /> Create order</Link>
          </>
        }
      />

      {list && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[[IndianRupee, 'Invoiced', sum(live), `${live.length} invoice${live.length === 1 ? '' : 's'}`],
            [Wallet, 'Paid', sum(paid), `${paid.length} paid`],
            [FileText, 'Outstanding', sum(unpaid), `${unpaid.length} awaiting payment`]].map(([Icon, label, value, sub]) => (
            <div key={label} className="card flex items-center gap-3 px-4 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cream text-brown-800"><Icon size={18} /></span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium uppercase tracking-[.18em] text-muted">{label}</span>
                <span className="block font-display text-2xl font-semibold leading-tight">{inr(value)}</span>
                <span className="block text-xs text-muted">{sub}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: '', label: 'All', count: list?.length },
          { value: 'paid', label: 'Paid', count: list ? paid.length : undefined },
          { value: 'unpaid', label: 'Unpaid', count: list ? unpaid.length : undefined },
          { value: 'cancelled', label: 'Cancelled', count: list ? list.length - live.length : undefined },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Invoice #, order #, customer, mobile" className="sm:w-80" />
      </div>

      <div className="card overflow-hidden">
        {!list ? <PageLoader /> : filtered.length === 0 ? (
          <EmptyState icon={FileText} title={list.length ? 'No matching invoices' : 'No invoices yet'} action={!list.length && <Link to="/orders/new" className="btn-primary"><Plus size={15} /> Create an order</Link>}>
            {list.length ? 'Try a different search or tab.' : 'Invoices appear here as soon as an order is placed.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Order</th><th className="text-right">Amount</th><th>Payment</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.orderId} className={`cursor-pointer ${i.status === 'Cancelled' ? 'opacity-60' : ''}`} onClick={() => navigate(`/invoices/${i.orderId}`)}>
                    <td>
                      <Link to={`/invoices/${i.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] font-medium text-brown-800 hover:underline">{i.invoiceNumber}</Link>
                      {i.source === 'admin' && <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brown-800">Admin</span>}
                    </td>
                    <td className="whitespace-nowrap text-muted">{fmtDate(i.invoiceDate)}</td>
                    <td>
                      <div className="font-medium">{i.customer?.name}</div>
                      <div className="text-xs text-muted">{i.customer?.customerCode} · +91 {i.customer?.phone}</div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link to={`/orders/${i.orderId}`} className="text-sm hover:underline">#{i.orderNumber}</Link>
                      <div className="text-xs text-muted">{i.items} item{i.items === 1 ? '' : 's'}</div>
                    </td>
                    <td className="text-right font-medium tabular-nums">{inr(i.total)}</td>
                    <td>{i.status === 'Cancelled' ? <StatusBadge status="Cancelled" /> : <StatusBadge status={i.paymentStatus} />}<div className="mt-0.5 text-xs text-muted">{i.paymentMethod}</div></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Link to={`/invoices/${i.orderId}`} className="icon-btn !size-8" title="View invoice" aria-label={`View ${i.invoiceNumber}`}><Eye size={15} /></Link>
                        <button className="icon-btn !size-8" onClick={() => quickDownload(i)} disabled={!!busy} title="Download PDF" aria-label={`Download ${i.invoiceNumber}`}>
                          <Download size={15} className={busy === i.orderId ? 'animate-pulse' : ''} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* off-screen render target for list downloads */}
      {pdfJob && (
        <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0 }} ref={hiddenRef}>
          <InvoiceDocument order={pdfJob.order} settings={pdfJob.settings} template={pdfJob.template} />
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}
