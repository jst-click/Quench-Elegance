import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClipboardList, KeyRound, Lock, MessageCircle, Phone, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useAuth, useToast } from '../context/AppContext';
import { BRAND, whatsappLink } from '../content';

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/account';
  const navigate = useNavigate();
  const toast = useToast();
  const { customer, login } = useAuth();

  const [step, setStep] = useState('phone'); // phone | otp | register
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [smsError, setSmsError] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

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
      setSmsError(d.smsError || '');
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
            <div className="auth-register">
              <span>New to Quench Elegance?</span>
              <Link to={digits.length === 10 ? `/register?phone=${digits}` : '/register'} className="btn btn-outline btn-block">
                <ClipboardList size={16} /> Register with a consultation
              </Link>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verify}>
            <button type="button" className="back-link" onClick={() => { setStep('phone'); setError(''); }}><ArrowLeft size={16} /> Change number</button>
            <span className="auth-icon"><KeyRound size={22} /></span>
            <h1>Enter OTP</h1>
            <p className="muted">{info}</p>
            {devOtp && <div className="alert alert-info">Test mode — your OTP is <strong>{devOtp}</strong>. (Hidden once SMS is configured.)</div>}
            {smsError && <div className="alert alert-error small">SMS not delivered: {smsError}</div>}
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
          <div className="auth-register-step">
            <button type="button" className="back-link" onClick={() => setStep('phone')}><ArrowLeft size={16} /> Try another number</button>
            <span className="auth-icon"><UserPlus size={22} /></span>
            <h1>Number not registered</h1>
            <p className="muted">
              <strong>+91 {digits}</strong> isn't registered with Quench Elegance yet. To register, complete a short hair &amp; scalp
              consultation. Our consultant reviews it and activates your account — then you can log in with OTP.
            </p>
            <Link to={`/register?phone=${digits}`} className="btn btn-primary btn-block">Start consultation <ArrowRight size={16} /></Link>
            <div className="auth-alt">
              <a className="btn btn-outline btn-sm" href={whatsappLink(`Hi, I'd like to register my number +91 ${digits} with Quench Elegance.`)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
              <a className="btn btn-outline btn-sm" href={`tel:+${BRAND.phoneRaw}`}><Phone size={15} /> Call us</a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
