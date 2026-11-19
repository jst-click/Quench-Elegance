import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download, FileText, Printer, Receipt, ScrollText, ShoppingBag } from 'lucide-react';
import { api } from '../lib/api';
import { downloadPdf, TEMPLATES } from '../lib/invoice';
import { Alert, PageHeader, PageLoader, StatusBadge } from '../components/ui';
import { useToast } from '../components/feedback';
import InvoiceDocument from '../components/InvoiceDocument';

const ICONS = { classic: FileText, modern: ScrollText, compact: Receipt };

export default function InvoiceView() {
  const { id } = useParams();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const docRef = useRef(null);

  useEffect(() => { api.get(`/invoices/${id}`).then(setData).catch((e) => setError(e.message)); }, [id]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <PageLoader />;
  const { order, settings } = data;
  const template = TEMPLATES.some((t) => t.id === params.get('t')) ? params.get('t') : settings.defaultTemplate || 'classic';

  const download = async () => {
    setBusy(true);
    try {
      await downloadPdf(docRef.current.firstElementChild, `${order.invoiceNumber}-${template}.pdf`, template);
      toast(`${order.invoiceNumber} downloaded`);
    } catch (e) {
      toast(`Couldn't create the PDF: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        back={{ to: '/invoices', label: 'Invoices' }}
        eyebrow="Invoice"
        title={order.invoiceNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Order <Link to={`/orders/${order.id}`} className="link">#{order.orderNumber}</Link> · {order.customer?.name}
            <StatusBadge status={order.paymentStatus} />
            {order.status === 'Cancelled' && <StatusBadge status="Cancelled" />}
          </span>
        }
        actions={
          <>
            <Link to={`/orders/${order.id}`} className="btn-outline"><ShoppingBag size={15} /> Order</Link>
            <button className="btn-outline" onClick={() => window.print()}><Printer size={15} /> Print</button>
            <button className="btn-primary" onClick={download} disabled={busy}><Download size={15} /> {busy ? 'Preparing PDF…' : 'Download PDF'}</button>
          </>
        }
      />

      <div className="mb-5 grid gap-2 sm:grid-cols-3 no-print" role="radiogroup" aria-label="Invoice design">
        {TEMPLATES.map((t) => {
          const Icon = ICONS[t.id];
          const on = template === t.id;
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={on}
              onClick={() => setParams({ t: t.id }, { replace: true })}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${on ? 'border-brown-800 bg-brown-800 text-white shadow-card' : 'border-silver-300 bg-white/70 hover:border-bronze'}`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-white/10 text-gold-soft' : 'bg-cream text-brown-800'}`}><Icon size={18} /></span>
              <span>
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className={`block text-xs ${on ? 'text-white/70' : 'text-muted'}`}>{t.hint}{settings.defaultTemplate === t.id ? ' · default' : ''}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* paper preview */}
      <div className="invoice-stage overflow-x-auto rounded-3xl bg-[#d9d6d2]/60 p-4 sm:p-8">
        <div className={`mx-auto w-fit shadow-lift ${template === 'compact' ? 'rounded-md' : ''}`} ref={docRef}>
          <InvoiceDocument order={order} settings={settings} template={template} />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted no-print">
        Business details, GSTIN and the default design are set in <Link to="/invoices?settings=1" className="link">Invoice settings</Link>.
      </p>
    </div>
  );
}
