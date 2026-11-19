import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Clock, Lock, ShieldCheck, SkipForward, Sparkles,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AppContext';
import '../styles/consult.css';

const DRAFT_KEY = 'qe_consult_draft';
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null; } catch { return null; } };
const writeDraft = (v) => { try { v ? localStorage.setItem(DRAFT_KEY, JSON.stringify(v)) : localStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ } };

const isEmpty = (field, v) => (field.type === 'consent' ? v !== true : v == null || v === '' || (Array.isArray(v) && v.length === 0));
const appliesTo = (section, answers) => {
  const c = section.condition;
  return !c || !(c.notIn || []).includes(answers[c.section]?.[c.field]);
};

/** Required-field + format checks for one section. Returns {fieldId: message}. */
function validateSection(section, values) {
  const errors = {};
  if (section.required) {
    for (const f of section.fields) if (f.required && isEmpty(f, values[f.id])) errors[f.id] = f.type === 'consent' ? 'Please confirm to continue.' : 'This field is required.';
  }
  if (section.id === 'personal') {
    const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);
    if (values.mobile && !/^[6-9]\d{9}$/.test(digits(values.mobile))) errors.mobile = 'Enter a valid 10-digit mobile number.';
    if (values.whatsapp && !/^[6-9]\d{9}$/.test(digits(values.whatsapp))) errors.whatsapp = 'Enter a valid 10-digit number, or leave empty.';
    if (values.age && (+values.age < 1 || +values.age > 120)) errors.age = 'Enter a valid age.';
    if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) errors.email = 'Enter a valid email.';
  }
  return errors;
}

/* ---------------- Field renderers ---------------- */
function Field({ field, values, set, error, num }) {
  const v = values[field.id];
  const id = `q-${field.id}`;
  const label = (
    <span className="q-label">
      {num && <span className="q-num">{num}</span>}
      {field.label}{field.required && field.type !== 'consent' && <em className="q-req" aria-label="required">*</em>}
    </span>
  );

  let control;
  if (['text', 'email', 'tel', 'date', 'number'].includes(field.type)) {
    control = (
      <input
        id={id} className="input" type={field.type === 'tel' ? 'tel' : field.type}
        inputMode={field.type === 'tel' || field.type === 'number' ? 'numeric' : undefined}
        min={field.min} max={field.max} placeholder={field.placeholder || ''}
        value={v || ''} onChange={(e) => set(field.id, e.target.value)}
        aria-invalid={!!error}
      />
    );
  } else if (field.type === 'textarea') {
    control = <textarea id={id} className="textarea" value={v || ''} onChange={(e) => set(field.id, e.target.value)} />;
  } else if (field.type === 'single') {
    control = (
      <div className="q-options" role="radiogroup" aria-label={field.label}>
        {field.options.map((o) => (
          <button type="button" key={o} role="radio" aria-checked={v === o} className={`q-opt ${v === o ? 'on' : ''}`} onClick={() => set(field.id, v === o ? '' : o)}>
            <span className="q-dot" />{o}
          </button>
        ))}
      </div>
    );
  } else if (field.type === 'multi') {
    const list = Array.isArray(v) ? v : [];
    const excl = field.exclusive || [];
    const toggle = (o) => set(field.id, (prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (cur.includes(o)) return cur.filter((x) => x !== o);
      if (excl.includes(o)) return [o];
      return [...cur.filter((x) => !excl.includes(x)), o];
    });
    const long = field.options.some((o) => o.length > 40);
    control = (
      <div className={`q-options ${long ? 'q-options-stack' : ''}`}>
        {field.options.map((o) => (
          <button type="button" key={o} role="checkbox" aria-checked={list.includes(o)} className={`q-opt q-opt-multi ${list.includes(o) ? 'on' : ''}`} onClick={() => toggle(o)}>
            <span className="q-box">{list.includes(o) && <Check size={12} strokeWidth={3} />}</span>{o}
          </button>
        ))}
      </div>
    );
  } else if (field.type === 'consent') {
    return (
      <label className={`q-consent ${v ? 'on' : ''} ${error ? 'has-error' : ''}`}>
        <input type="checkbox" checked={!!v} onChange={(e) => set(field.id, e.target.checked)} />
        <span className="q-box">{v && <Check size={12} strokeWidth={3} />}</span>
        <span>{field.label}</span>
        {error && <small className="q-error">{error}</small>}
      </label>
    );
  }

  const showOther = field.other && (v === 'Other' || (Array.isArray(v) && v.includes('Other')));
  const fu = field.followUp;
  return (
    <div className={`q-field ${field.half ? 'half' : ''} ${num ? 'q-question' : ''} ${error ? 'has-error' : ''}`}>
      {['single', 'multi'].includes(field.type) ? <p className="q-legend">{label}{field.type === 'multi' && <span className="q-hint">Select all that apply</span>}</p> : <label htmlFor={id}>{label}</label>}
      {control}
      {showOther && <input className="input q-extra" placeholder="Please specify" value={values[`${field.id}Other`] || ''} onChange={(e) => set(`${field.id}Other`, e.target.value)} />}
      {fu && v === fu.when && <input className="input q-extra" placeholder={fu.label} value={values[fu.id] || ''} onChange={(e) => set(fu.id, e.target.value)} />}
      {error && <small className="q-error">{error}</small>}
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { customer } = useAuth();
  const phoneParam = (params.get('phone') || '').replace(/\D/g, '').slice(-10);

  const [sections, setSections] = useState(null);
  const [loadError, setLoadError] = useState('');
  const draft = useMemo(readDraft, []);
  const [answers, setAnswers] = useState(() => {
    const a = draft?.answers || {};
    return phoneParam ? { ...a, personal: { ...(a.personal || {}), mobile: phoneParam } } : a;
  });
  const [skipped, setSkipped] = useState(draft?.skipped || []);
  const [visited, setVisited] = useState(draft?.visited || []);
  const [step, setStep] = useState(draft?.step ?? -1); // -1 = welcome screen
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState('');
  const topRef = useRef(null);

  useEffect(() => { if (customer) navigate('/account', { replace: true }); }, [customer, navigate]);
  useEffect(() => {
    document.title = 'Register — Hair & Scalp Consultation | Quench Elegance';
    api.get('/api/auth/consultation-form', { auth: null }).then((d) => setSections(d.sections)).catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => { if (!done) writeDraft({ answers, skipped, visited, step }); }, [answers, skipped, visited, step, done]);

  // sections that apply to this client (e.g. women's health is hidden for men)
  const active = useMemo(() => (sections || []).filter((s) => appliesTo(s, answers)), [sections, answers]);
  const current = active[step];
  const values = (current && answers[current.id]) || {};

  const go = (i) => {
    setErrors({}); setFormError('');
    setStep(i);
    if (i >= 0 && active[i]) setVisited((v) => (v.includes(active[i].id) ? v : [...v, active[i].id]));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  useEffect(() => { if (step >= active.length && active.length) setStep(active.length - 1); }, [active.length, step]);

  // val may be an updater fn(prev) so rapid clicks on multi-select options never drop a choice
  const set = (fid, val) => {
    setAnswers((a) => {
      const sec = a[current.id] || {};
      return { ...a, [current.id]: { ...sec, [fid]: typeof val === 'function' ? val(sec[fid]) : val } };
    });
    if (errors[fid]) setErrors((e) => { const n = { ...e }; delete n[fid]; return n; });
    if (skipped.includes(current.id)) setSkipped((s) => s.filter((x) => x !== current.id));
  };

  const statusOf = (s) => {
    if (skipped.includes(s.id)) return 'skipped';
    const vals = answers[s.id] || {};
    const filled = s.fields.some((f) => !isEmpty(f, vals[f.id]));
    if (s.required) return Object.keys(validateSection(s, vals)).length === 0 ? 'done' : visited.includes(s.id) ? 'todo' : 'pending';
    return filled ? 'done' : 'pending';
  };

  const next = () => {
    const errs = validateSection(current, values);
    if (Object.keys(errs).length) { setErrors(errs); setFormError('Please complete the highlighted fields.'); return; }
    if (step < active.length - 1) go(step + 1); else submit();
  };
  const skip = () => {
    setSkipped((s) => (s.includes(current.id) ? s : [...s, current.id]));
    if (step < active.length - 1) go(step + 1);
  };

  const submit = async () => {
    // every required section must be complete before submitting
    for (let i = 0; i < active.length; i++) {
      const s = active[i];
      if (!s.required) continue;
      const errs = validateSection(s, answers[s.id] || {});
      if (Object.keys(errs).length) { go(i); setErrors(errs); setFormError(`Section ${s.number} is required — please complete it before submitting.`); return; }
    }
    setSubmitting(true); setFormError('');
    try {
      const d = await api.post('/api/auth/register-request', { consultation: { answers, skipped: skipped.filter((id) => active.some((s) => s.id === id)) } }, { auth: null });
      writeDraft(null);
      setDone(d.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const i = active.findIndex((s) => s.id === err.data?.section);
      if (i >= 0) { go(i); if (err.data?.field) setErrors({ [err.data.field]: err.message }); }
      setFormError(err.message);
      if (err.data?.code === 'ALREADY_REGISTERED') writeDraft(null);
    } finally { setSubmitting(false); }
  };

  /* ---------- screens ---------- */
  if (loadError) return <section className="consult-page"><div className="container"><div className="alert alert-error">{loadError}</div></div></section>;
  if (!sections || (step >= 0 && !current)) return <div className="page-loader"><div className="spinner" /></div>;

  const requiredCount = active.filter((s) => s.required).length;
  const doneCount = active.filter((s) => statusOf(s) !== 'pending' && statusOf(s) !== 'todo').length;
  const pct = Math.round((doneCount / active.length) * 100);
  const mobile = answers.personal?.mobile || phoneParam;

  if (done) {
    return (
      <section className="consult-page">
        <div className="container consult-done card">
          <span className="consult-done-icon"><CheckCircle2 size={34} /></span>
          <span className="eyebrow center">Consultation submitted</span>
          <h1>Thank you, {answers.personal?.fullName?.split(' ')[0] || 'dear'}.</h1>
          <p className="muted">{done}</p>
          <ol className="consult-next">
            <li><strong>Review</strong><span>Our consultant reads your consultation carefully.</span></li>
            <li><strong>Approval</strong><span>Your account is activated for <b>+91 {mobile}</b>.</span></li>
            <li><strong>Log in</strong><span>Sign in with an OTP and receive your personalised routine.</span></li>
          </ol>
          <div className="hero-ctas center">
            <Link to="/shop" className="btn btn-primary">Explore products</Link>
            <Link to="/" className="btn btn-outline">Back to home</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="consult-page" ref={topRef}>
      <div className="consult-hero">
        <div className="container">
          <span className="eyebrow light">Quench Elegance · Confidential client record</span>
          <h1>Hair &amp; Scalp Health Consultation</h1>
          <p>Understanding hair · Identifying contributing factors · Personalised care</p>
        </div>
      </div>

      <div className="container consult-shell">
        {step === -1 ? (
          <div className="consult-welcome card">
            <span className="auth-icon"><ClipboardList size={22} /></span>
            <h2>Register with a personal consultation</h2>
            <p className="muted">
              Before we activate your account, our consultant would like to understand your hair, scalp, health and routine — so every
              recommendation is made for you.
            </p>
            <ul className="consult-facts">
              <li><Clock size={18} /><span><strong>About 8–10 minutes</strong>{active.length} short sections, one at a time.</span></li>
              <li><ShieldCheck size={18} /><span><strong>{requiredCount} required sections</strong>Marked “Required”. The rest you can skip.</span></li>
              <li><Lock size={18} /><span><strong>Private &amp; confidential</strong>Seen only by the Quench Elegance team.</span></li>
              <li><Sparkles size={18} /><span><strong>Progress is saved</strong>On this device, if you need a break.</span></li>
            </ul>
            {mobile && <div className="alert alert-info">Registering mobile number <strong>+91 {mobile}</strong></div>}
            <div className="consult-welcome-actions">
              <Link to="/login" className="btn btn-outline"><ArrowLeft size={16} /> Back to login</Link>
              <button className="btn btn-primary" onClick={() => go(visited.length ? Math.min(Math.max(draft?.step ?? 0, 0), active.length - 1) : 0)}>
                {visited.length ? 'Continue consultation' : 'Begin consultation'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="consult-layout">
            {/* Section list */}
            <aside className="consult-steps" aria-label="Consultation sections">
              <div className="consult-progress">
                <div className="consult-progress-head"><span>Your progress</span><strong>{pct}%</strong></div>
                <div className="consult-bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
              <ol>
                {active.map((s, i) => {
                  const st = statusOf(s);
                  const canOpen = i <= step || visited.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button type="button" disabled={!canOpen} onClick={() => go(i)} className={`consult-step st-${st} ${i === step ? 'current' : ''}`}>
                        <span className="consult-step-num">{st === 'done' ? <Check size={14} strokeWidth={3} /> : s.number}</span>
                        <span className="consult-step-text">
                          <span className="consult-step-title">{s.title}</span>
                          <span className="consult-step-meta">{st === 'skipped' ? 'Skipped' : s.required ? 'Required' : 'Optional'}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>

            {/* Current section */}
            <div className="consult-main">
              <div className="consult-mobile-progress">
                <span>Section {step + 1} of {active.length}</span>
                <div className="consult-bar"><span style={{ width: `${((step + 1) / active.length) * 100}%` }} /></div>
              </div>

              <article className="consult-card card" key={current.id}>
                <header className="consult-card-head">
                  <span className="consult-card-num" aria-hidden="true">{String(current.number).padStart(2, '0')}</span>
                  <div className="consult-card-title">
                    <div className="consult-card-meta">
                      <span className={`consult-tag ${current.required ? 'req' : ''}`}>{current.required ? 'Required' : 'Optional'}</span>
                      <span>Step {step + 1} of {active.length}</span>
                    </div>
                    <h2>{current.title}</h2>
                    {current.subtitle && <p className="muted">{current.subtitle}</p>}
                  </div>
                </header>

                {current.id === 'declaration' && (
                  <div className="consult-note">
                    Quench Elegance offers cosmetic hair &amp; scalp care. For sudden, severe or patchy hair loss, or scalp inflammation, our consultant may recommend seeing a dermatologist.
                  </div>
                )}

                <div className="consult-body">
                <div className="consult-fields">
                  {(() => {
                    let n = 0; // number the multiple-choice questions so long sections are easy to follow
                    return current.fields.map((f) => (
                      <Field key={f.id} field={f} values={values} set={set} error={errors[f.id]} num={['single', 'multi'].includes(f.type) && current.fields.filter((x) => ['single', 'multi'].includes(x.type)).length > 1 ? ++n : null} />
                    ));
                  })()}
                </div>

                {formError && <div className="alert alert-error">{formError}</div>}
                </div>

                <footer className="consult-actions">
                  <div className="consult-actions-progress" aria-hidden="true"><span style={{ width: `${((step + 1) / active.length) * 100}%` }} /></div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => go(step - 1)}>
                    <ArrowLeft size={15} /> {step === 0 ? 'Introduction' : 'Back'}
                  </button>
                  <div className="consult-actions-right">
                    {!current.required && step < active.length - 1 && (
                      <button type="button" className="btn btn-link consult-skip" onClick={skip}>Skip section <SkipForward size={14} /></button>
                    )}
                    <button type="button" className="btn btn-primary btn-sm" onClick={next} disabled={submitting}>
                      {step === active.length - 1 ? (submitting ? 'Submitting…' : <>Submit consultation <Check size={15} /></>) : <>Next <ArrowRight size={15} /></>}
                    </button>
                  </div>
                </footer>
              </article>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
