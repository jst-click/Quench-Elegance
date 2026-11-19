import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Mail, MapPin, MessageCircle, Phone, Printer, ShieldCheck, X } from 'lucide-react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Alert, Avatar, Field, PageHeader, PageLoader, StatusBadge } from '../components/ui';
import { ConsultantEditor, ConsultationAnswers, ReferralFlags, useConsultationForm } from '../components/Consultation';
import { useConfirm, useToast } from '../components/feedback';
import { useAuth } from '../components/auth';

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { admin, refreshCounts } = useAuth();
  const { form, products } = useConsultationForm();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [consultant, setConsultant] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/registration-requests/${id}`).then((d) => {
      setData(d);
      setConsultant({ details: { consultationDate: new Date().toISOString().slice(0, 10), consultantName: admin.name, visitType: 'First consultation' } });
    }).catch((e) => setError(e.message));
  }, [id, admin.name]);

  if (error) return <Alert>{error}</Alert>;
  if (!data || !form) return <PageLoader />;
  const r = data.request;
  const p = r.consultation?.answers?.personal || {};
  const pending = r.status === 'pending';

  const approve = async () => {
    setBusy(true);
    try {
      const d = await api.post(`/registration-requests/${id}/approve`, { customerCode: code, consultant });
      toast(`${r.name} approved · User ID ${d.customer.customerCode}`);
      refreshCounts();
      navigate(`/customers/${d.customer.id}?tab=consultation`);
    } catch (e) { toast(e.message, 'error'); setBusy(false); }
  };
  const reject = async () => {
    const ok = await confirm({ title: `Reject ${r.name}?`, body: 'They will not be able to log in. They can register again later.', confirmLabel: 'Reject', danger: true });
    if (!ok) return;
    try {
      await api.post(`/registration-requests/${id}/reject`);
      toast('Request rejected');
      refreshCounts();
      navigate('/requests');
    } catch (e) { toast(e.message, 'error'); }
  };

  const wa = (p.whatsapp || r.phone || '').replace(/\D/g, '').slice(-10);

  return (
    <div>
      <PageHeader
        back={{ to: '/requests', label: 'Registration requests' }}
        eyebrow="Consultation review"
        title={<span className="flex items-center gap-4"><Avatar name={r.name} className="size-14 text-lg" /><span>{r.name}</span></span>}
        subtitle={<span className="flex flex-wrap items-center gap-2">Submitted {fmtDate(r.consultation?.submittedAt || r.createdAt, true)} <StatusBadge status={r.status} /></span>}
        actions={<button className="btn-outline" onClick={() => window.print()}><Printer size={15} /> Print</button>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <ReferralFlags flags={data.flags} />

          <div>
            <h2 className="mb-3 flex items-baseline gap-3 text-2xl">Client answers <span className="font-sans text-xs font-normal text-muted">Sections 1–10 &amp; 14 · filled by the client</span></h2>
            <ConsultationAnswers form={form} consultation={r.consultation} />
          </div>

          {pending && (
            <div className="no-print">
              <h2 className="mb-3 flex items-baseline gap-3 text-2xl">Consultant record <span className="font-sans text-xs font-normal text-muted">Optional now — you can complete it later on the customer's page</span></h2>
              <ConsultantEditor form={form} products={products} value={consultant} onChange={setConsultant} />
            </div>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start no-print">
          {pending ? (
            <section className="card card-pad space-y-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-brown-800 text-gold-soft"><ShieldCheck size={19} /></span>
                <div>
                  <h2 className="card-title leading-tight">Approve registration</h2>
                  <p className="text-xs text-muted">Creates the customer so they can log in with OTP.</p>
                </div>
              </div>
              <Field label="User ID" hint="Leave empty to auto-generate (e.g. QE1002).">
                <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto" />
              </Field>
              <button className="btn-primary w-full" onClick={approve} disabled={busy}><Check size={16} /> {busy ? 'Approving…' : 'Approve & create customer'}</button>
              <button className="btn-danger w-full" onClick={reject} disabled={busy}><X size={16} /> Reject</button>
            </section>
          ) : (
            <section className="card card-pad">
              <h2 className="card-title">This request was {r.status}</h2>
              {r.customerId && <Link to={`/customers/${r.customerId}?tab=consultation`} className="btn-primary mt-4 w-full">Open customer</Link>}
            </section>
          )}

          <section className="card card-pad">
            <h2 className="card-title mb-3">Contact</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5"><Phone size={15} className="text-bronze" /><a href={`tel:+91${r.phone}`} className="hover:underline">+91 {r.phone}</a></li>
              {wa && <li className="flex items-center gap-2.5"><MessageCircle size={15} className="text-bronze" /><a href={`https://wa.me/91${wa}`} target="_blank" rel="noreferrer" className="hover:underline">WhatsApp +91 {wa}</a></li>}
              {r.email && <li className="flex items-center gap-2.5"><Mail size={15} className="text-bronze" /><a href={`mailto:${r.email}`} className="truncate hover:underline">{r.email}</a></li>}
              {r.city && <li className="flex items-center gap-2.5"><MapPin size={15} className="text-bronze" />{r.city}</li>}
            </ul>
            {(p.age || p.gender) && <p className="mt-4 rounded-xl bg-silver-50/80 px-3 py-2 text-sm text-ink-2">{[p.age && `${p.age} yrs`, p.gender, p.occupation].filter(Boolean).join(' · ')}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
