import { useState } from 'react';
import { Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { api } from '../api';
import { BRAND, whatsappLink } from '../content';
import { PageHero, Reveal } from '../components/ui';

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: '', message: '' });
  const [state, setState] = useState({ loading: false, ok: '', error: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, ok: '', error: '' });
    try {
      const d = await api.post('/api/contact', form, { auth: null });
      setState({ loading: false, ok: d.message, error: '' });
      setForm({ name: '', phone: '', email: '', subject: '', message: '' });
    } catch (err) {
      setState({ loading: false, ok: '', error: err.message });
    }
  };

  return (
    <>
      <PageHero eyebrow="Contact" title="We're here to guide you" subtitle="Questions about a product, your hair-care routine, registration or partnership? Reach out — our team responds personally." />
      <section className="section">
        <div className="container contact">
          <Reveal className="contact-info">
            <a href={`tel:+${BRAND.phoneRaw}`} className="contact-item"><Phone size={20} /><div><span>Call us</span><strong>{BRAND.phone}</strong></div></a>
            <a href={whatsappLink()} target="_blank" rel="noreferrer" className="contact-item"><MessageCircle size={20} /><div><span>WhatsApp</span><strong>Chat with our team</strong></div></a>
            <a href={`mailto:${BRAND.email}`} className="contact-item"><Mail size={20} /><div><span>Email</span><strong>{BRAND.email}</strong></div></a>
            <a href={BRAND.instagram} target="_blank" rel="noreferrer" className="contact-item"><Instagram size={20} /><div><span>Instagram</span><strong>{BRAND.instagramHandle}</strong></div></a>
            <div className="contact-item"><MapPin size={20} /><div><span>Visit</span><strong>{BRAND.address}</strong></div></div>
          </Reveal>
          <Reveal as="form" className="contact-form card" onSubmit={submit} delay={100}>
            <h2>Send us a message</h2>
            <div className="form-grid">
              <div className="field"><label htmlFor="c-name">Name *</label><input id="c-name" className="input" value={form.name} onChange={set('name')} required /></div>
              <div className="field"><label htmlFor="c-phone">Mobile</label><input id="c-phone" className="input" inputMode="tel" value={form.phone} onChange={set('phone')} /></div>
              <div className="field span-2"><label htmlFor="c-email">Email</label><input id="c-email" type="email" className="input" value={form.email} onChange={set('email')} /></div>
              <div className="field span-2">
                <label htmlFor="c-subj">Topic</label>
                <select id="c-subj" className="select" value={form.subject} onChange={set('subject')}>
                  <option value="">Choose a topic</option>
                  <option>Product enquiry</option>
                  <option>Hair-care guidance</option>
                  <option>Customer registration</option>
                  <option>Order support</option>
                  <option>Partnership / affiliate</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field span-2"><label htmlFor="c-msg">Message *</label><textarea id="c-msg" className="textarea" value={form.message} onChange={set('message')} required /></div>
            </div>
            {state.error && <div className="alert alert-error">{state.error}</div>}
            {state.ok && <div className="alert alert-success">{state.ok}</div>}
            <button className="btn btn-primary" disabled={state.loading}>{state.loading ? 'Sending…' : 'Send message'}</button>
          </Reveal>
        </div>
      </section>
    </>
  );
}
