import { forwardRef } from 'react';
import { amountInWords, gstBreakdown, money } from '../lib/invoice';
import '../styles/invoice.css';

const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Shared figures for every template. */
function useFigures(order, settings) {
  const gst = gstBreakdown(order.total, settings, order.address);
  const title = settings.gstin ? 'Tax Invoice' : 'Invoice';
  const cancelled = order.status === 'Cancelled';
  const paid = order.paymentStatus === 'Paid';
  return { gst, title, cancelled, paid };
}

function ItemName({ i }) {
  return (
    <>
      <span className="inv-item-name">{i.comboId && <span className="inv-kit">Kit</span>}{i.name}</span>
      {i.size && <span className="inv-item-meta">{i.size}</span>}
      {i.components && <span className="inv-item-meta">Contains: {i.components.map((c) => `${c.name} × ${c.qty * i.qty}`).join(', ')}</span>}
    </>
  );
}

function Totals({ order, gst, className = '' }) {
  return (
    <table className={`inv-totals ${className}`}>
      <tbody>
        <tr><td>Subtotal</td><td>{money(order.subtotal)}</td></tr>
        {order.discount > 0 && <tr><td>Discount</td><td>− {money(order.discount)}</td></tr>}
        <tr><td>Shipping</td><td>{order.shipping ? money(order.shipping) : 'Free'}</td></tr>
        {gst && (
          <>
            <tr className="inv-muted"><td>Taxable value</td><td>{money(gst.taxable, true)}</td></tr>
            {gst.intra ? (
              <>
                <tr className="inv-muted"><td>CGST @ {gst.rate / 2}%</td><td>{money(gst.half, true)}</td></tr>
                <tr className="inv-muted"><td>SGST @ {gst.rate / 2}%</td><td>{money(gst.tax - gst.half, true)}</td></tr>
              </>
            ) : <tr className="inv-muted"><td>IGST @ {gst.rate}%</td><td>{money(gst.tax, true)}</td></tr>}
          </>
        )}
        <tr className="inv-grand"><td>Total</td><td>{money(order.total)}</td></tr>
      </tbody>
    </table>
  );
}

function Stamp({ cancelled, paid }) {
  if (cancelled) return <div className="inv-stamp inv-stamp-void">Cancelled</div>;
  if (paid) return <div className="inv-stamp">Paid</div>;
  return null;
}

/* ---------------- Classic: brand header band, bordered table ---------------- */
function Classic({ order, settings, f }) {
  const a = order.address || {};
  const c = order.customer || {};
  return (
    <div className="inv inv-a4 inv-classic">
      <header className="inv-c-head">
        <div>
          <img src="/admin/images/brand/logo-white.png" alt="" className="inv-c-logo" crossOrigin="anonymous" />
          <p className="inv-c-tag">{settings.tagline}</p>
        </div>
        <div className="inv-c-title">
          <h1>{f.title}</h1>
          <p># {order.invoiceNumber}</p>
        </div>
      </header>
      <div className="inv-c-rule" />

      <section className="inv-c-parties">
        <div>
          <h4>From</h4>
          <strong>{settings.businessName}</strong>
          <p>{settings.address}</p>
          <p>{[settings.phone, settings.email].filter(Boolean).join(' · ')}</p>
          {settings.gstin && <p><b>GSTIN:</b> {settings.gstin}</p>}
        </div>
        <div>
          <h4>Bill to</h4>
          <strong>{c.name}</strong>
          <p>User ID {c.customerCode}</p>
          <p>+91 {c.phone}{c.email ? ` · ${c.email}` : ''}</p>
        </div>
        <div>
          <h4>Ship to</h4>
          <strong>{a.name}</strong>
          <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
          <p>{a.city}, {a.state} – {a.pincode}</p>
          <p>{a.phone}</p>
        </div>
      </section>

      <section className="inv-c-meta">
        {[['Invoice date', date(order.invoiceDate)], ['Order no.', `#${order.orderNumber}`], ['Order date', date(order.createdAt)],
          ['Payment', order.paymentMethod], ['Payment status', order.paymentStatus]].map(([k, v]) => (
          <div key={k}><span>{k}</span><strong>{v}</strong></div>
        ))}
      </section>

      <table className="inv-table inv-c-table">
        <thead><tr><th>#</th><th>Item</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {order.items.map((i, n) => (
            <tr key={i.comboId || i.productId}>
              <td>{n + 1}</td>
              <td><ItemName i={i} /></td>
              <td className="r">{i.qty}</td>
              <td className="r">{money(i.price)}</td>
              <td className="r">{money(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="inv-c-bottom">
        <div className="inv-c-words">
          <h4>Amount in words</h4>
          <p>{amountInWords(order.total)}</p>
          {!f.gst && <p className="inv-note">All prices are inclusive of applicable taxes.</p>}
          {order.notes && <><h4>Note</h4><p>{order.notes}</p></>}
          <Stamp cancelled={f.cancelled} paid={f.paid} />
        </div>
        <Totals order={order} gst={f.gst} />
      </section>

      <footer className="inv-c-foot">
        <div>
          <h4>Terms</h4>
          <p>{settings.terms}</p>
        </div>
        <div className="inv-sign">
          <p>For {settings.businessName}</p>
          <span />
          <p>{settings.signatory}</p>
        </div>
      </footer>
      <p className="inv-c-thanks">{settings.footer}{settings.website ? ` · ${settings.website}` : ''}</p>
    </div>
  );
}

/* ---------------- Modern: white, minimal, gold accent ---------------- */
function Modern({ order, settings, f }) {
  const a = order.address || {};
  const c = order.customer || {};
  return (
    <div className="inv inv-a4 inv-modern">
      <div className="inv-m-accent" />
      <header className="inv-m-head">
        <img src="/admin/images/brand/logo-brown.png" alt="" className="inv-m-logo" crossOrigin="anonymous" />
        <div className="inv-m-seller">
          <strong>{settings.businessName}</strong>
          <p>{settings.address}</p>
          <p>{[settings.phone, settings.email, settings.website].filter(Boolean).join('  ·  ')}</p>
          {settings.gstin && <p>GSTIN {settings.gstin}</p>}
        </div>
      </header>

      <section className="inv-m-titlebar">
        <div>
          <h1>{f.title}</h1>
          <p>{order.invoiceNumber}</p>
        </div>
        <div className="inv-m-amount">
          <span>Amount {f.paid ? 'paid' : 'due'}</span>
          <strong>{money(order.total)}</strong>
        </div>
      </section>

      <section className="inv-m-grid">
        <div><span>Billed to</span><strong>{c.name}</strong><p>+91 {c.phone}</p>{c.email && <p>{c.email}</p>}<p>User ID {c.customerCode}</p></div>
        <div><span>Deliver to</span><strong>{a.name}</strong><p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p><p>{a.city}, {a.state} – {a.pincode}</p></div>
        <div>
          <span>Details</span>
          <p>Issued <b>{date(order.invoiceDate)}</b></p>
          <p>Order <b>#{order.orderNumber}</b></p>
          <p>{order.paymentMethod} · <b>{order.paymentStatus}</b></p>
        </div>
      </section>

      <table className="inv-table inv-m-table">
        <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Total</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.comboId || i.productId}>
              <td><ItemName i={i} /></td>
              <td className="r">{i.qty}</td>
              <td className="r">{money(i.price)}</td>
              <td className="r">{money(i.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="inv-m-bottom">
        <div>
          <p className="inv-m-words">{amountInWords(order.total)}</p>
          {!f.gst && <p className="inv-note">All prices are inclusive of applicable taxes.</p>}
          {order.notes && <p className="inv-note">Note: {order.notes}</p>}
          <Stamp cancelled={f.cancelled} paid={f.paid} />
        </div>
        <Totals order={order} gst={f.gst} className="inv-m-totals" />
      </section>

      <footer className="inv-m-foot">
        <p>{settings.terms}</p>
        <div className="inv-sign"><span /><p>{settings.signatory}</p></div>
      </footer>
      <p className="inv-m-thanks">{settings.footer}</p>
    </div>
  );
}

/* ---------------- Compact: 80 mm receipt ---------------- */
function Compact({ order, settings, f }) {
  const c = order.customer || {};
  const a = order.address || {};
  return (
    <div className="inv inv-receipt">
      <img src="/admin/images/brand/logo-brown.png" alt="" className="inv-r-logo" crossOrigin="anonymous" />
      <p className="inv-r-center">{settings.address}</p>
      <p className="inv-r-center">{settings.phone}</p>
      {settings.gstin && <p className="inv-r-center">GSTIN {settings.gstin}</p>}
      <div className="inv-r-cut" />
      <p className="inv-r-title">{f.title}</p>
      <div className="inv-r-kv"><span>Invoice</span><span>{order.invoiceNumber}</span></div>
      <div className="inv-r-kv"><span>Date</span><span>{date(order.invoiceDate)}</span></div>
      <div className="inv-r-kv"><span>Order</span><span>#{order.orderNumber}</span></div>
      <div className="inv-r-kv"><span>Customer</span><span>{c.name}</span></div>
      <div className="inv-r-kv"><span>Mobile</span><span>+91 {c.phone}</span></div>
      <div className="inv-r-cut" />
      {order.items.map((i) => (
        <div key={i.comboId || i.productId} className="inv-r-item">
          <div className="inv-r-kv"><b>{i.comboId ? 'KIT · ' : ''}{i.name}</b><b>{money(i.lineTotal)}</b></div>
          <div className="inv-r-sub">{i.qty} × {money(i.price)}{i.size ? ` · ${i.size}` : ''}</div>
        </div>
      ))}
      <div className="inv-r-cut" />
      <div className="inv-r-kv"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
      {order.discount > 0 && <div className="inv-r-kv"><span>Discount</span><span>− {money(order.discount)}</span></div>}
      <div className="inv-r-kv"><span>Shipping</span><span>{order.shipping ? money(order.shipping) : 'Free'}</span></div>
      {f.gst && <div className="inv-r-kv inv-r-sub"><span>incl. GST {f.gst.rate}%</span><span>{money(f.gst.tax, true)}</span></div>}
      <div className="inv-r-kv inv-r-total"><span>TOTAL</span><span>{money(order.total)}</span></div>
      <div className="inv-r-kv"><span>{order.paymentMethod}</span><span>{f.cancelled ? 'CANCELLED' : order.paymentStatus.toUpperCase()}</span></div>
      <div className="inv-r-cut" />
      <p className="inv-r-center inv-r-sub">Ship to: {a.name}, {a.city} – {a.pincode}</p>
      <p className="inv-r-center inv-r-thanks">{settings.footer}</p>
      {settings.website && <p className="inv-r-center inv-r-sub">{settings.website}</p>}
    </div>
  );
}

/** The printable invoice. `template` = classic | modern | compact. Ref points at the page for PDF export. */
const InvoiceDocument = forwardRef(function InvoiceDocument({ order, settings, template = 'classic' }, ref) {
  const f = useFigures(order, settings);
  const Tpl = { classic: Classic, modern: Modern, compact: Compact }[template] || Classic;
  return <div ref={ref} className="inv-root"><Tpl order={order} settings={settings} f={f} /></div>;
});

export default InvoiceDocument;
