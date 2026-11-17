import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, MessageCircle, Phone, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useAuth, useToast } from '../context/AppContext';
import { BRAND, whatsappLink } from '../content';

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/account';
  const navigate = useNavigate();
  const toast = useToast();
  const { customer, login } = useAuth();

  const [step, setStep] = useState('phone'); // phone | otp | register | requested
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [reg, setReg] = useState({ name: '', email: '', city: '', message: '' });

  useEffect(() => { if (customer) navigate(next, { replace: true }); }, [customer, next, navigate]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const digits = phone.replace(/\D/g, '').slice(-10);

  const requestOtp = async (e) => {
    e?.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      const d = await api.post('/api/auth/otp/request', { phone: digits }, { auth: null });
      setInfo(d.message);
      setDevOtp(d.devOtp || '');
      setResendIn(d.resendInSeconds || 30);
      setOtp('');
      setStep('otp');
    } catch (err) {
      if (err.data?.code === 'NOT_REGISTERED') { setStep('register'); setError(''); }
      else { setError(err.message); if (err.data?.retryAfter) { setResendIn(err.data.retryAfter); } }
    } finally { setLoading(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const d = await api.post('/api/auth/otp/verify', { phone: digits, otp }, { auth: null });
      login(d.token, d.customer);
      toast(`Welcome, ${d.customer.name}`);
      navigate(next, { replace: true });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const sendRequest = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const d = await api.post('/api/auth/register-request', { ...reg, phone: digits }, { auth: null });
      setInfo(d.message);
      setStep('requested');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <section className="auth-page">
      <div className="auth-art" aria-hidden="true">
        <img src="/images/brand/logo-white.png" alt="" />
        <p>Luxury, strand by strand.</p>
      </div>
      <div className="auth-card card">
        {step === 'phone' && (
          <form onSubmit={requestOtp}>
            <span className="auth-icon"><Phone size={22} /></span>
            <h1>Login with OTP</h1>
            <p className="muted">Registered Quench Elegance customers can log in and order using their mobile number.</p>
            <div className="field">
              <label htmlFor="phone">Mobile number</label>
              <div className="phone-input">
                <span>+91</span>
                <input id="phone" className="input" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 12))} required autoFocus />
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={loading || digits.length !== 10}>{loading ? 'Sending OTP…' : 'Send OTP'}</button>
            <p className="auth-foot"><Lock size={14} /> Only mobile numbers registered by Quench Elegance can place orders.</p>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verify}>
            <button type="button" className="back-link" onClick={() => { setStep('phone'); setError(''); }}><ArrowLeft size={16} /> Change number</button>
            <span className="auth-icon"><KeyRound size={22} /></span>
            <h1>Enter OTP</h1>
            <p className="muted">{info}</p>
            {devOtp && <div className="alert alert-info">Test mode — your OTP is <strong>{devOtp}</strong>. (Hidden once SMS is configured.)</div>}
            <div className="field">
              <label htmlFor="otp">6-digit OTP</label>
              <input id="otp" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={loading || otp.length !== 6}>{loading ? 'Verifying…' : 'Verify & continue'}</button>
            <p className="auth-foot">
              {resendIn > 0 ? <>Resend OTP in {resendIn}s</> : <button type="button" className="btn-link" onClick={requestOtp}>Resend OTP</button>}
            </p>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={sendRequest}>
            <button type="button" className="back-link" onClick={() => setStep('phone')}><ArrowLeft size={16} /> Try another number</button>
            <span className="auth-icon"><UserPlus size={22} /></span>
            <h1>Number not registered</h1>
            <p className="muted">
              <strong>+91 {digits}</strong> isn't registered with Quench Elegance yet. Share your details and our team will verify and activate your account — or reach us directly.
            </p>
            <div className="form-grid">
              <div className="field span-2"><label htmlFor="r-name">Full name *</label><input id="r-name" className="input" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} required /></div>
              <div className="field"><label htmlFor="r-email">Email</label><input id="r-email" type="email" className="input" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} /></div>
              <div className="field"><label htmlFor="r-city">City</label><input id="r-city" className="input" value={reg.city} onChange={(e) => setReg({ ...reg, city: e.target.value })} /></div>
              <div className="field span-2"><label htmlFor="r-msg">Message (optional)</label><textarea id="r-msg" className="textarea" style={{ minHeight: 70 }} value={reg.message} onChange={(e) => setReg({ ...reg, message: e.target.value })} /></div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Sending…' : 'Request registration'}</button>
            <div className="auth-alt">
              <a className="btn btn-outline btn-sm" href={whatsappLink(`Hi, please register my number +91 ${digits} with Quench Elegance.`)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
              <a className="btn btn-outline btn-sm" href={`tel:+${BRAND.phoneRaw}`}><Phone size={15} /> Call us</a>
            </div>
          </form>
        )}

        {step === 'requested' && (
          <div className="center-text">
            <span className="auth-icon"><UserPlus size={22} /></span>
            <h1>Request received</h1>
            <p className="muted">{info}</p>
            <p className="muted">Once activated, log in with <strong>+91 {digits}</strong> and OTP.</p>
            <Link to="/shop" className="btn btn-primary">Continue browsing</Link>
          </div>
        )}
      </div>
    </section>
  );
}
