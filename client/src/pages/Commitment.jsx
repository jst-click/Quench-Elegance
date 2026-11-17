import { Link } from 'react-router-dom';
import { BadgeCheck, Eye, HeartHandshake, Scale, CheckCircle2 } from 'lucide-react';
import { PageHero, Reveal, SectionHead } from '../components/ui';

const VALUES = [
  { icon: BadgeCheck, title: 'Quality with purpose', body: 'We are committed to thoughtfully formulated hair and scalp care products, with a focus on quality, consistency, and continuous improvement.' },
  { icon: HeartHandshake, title: 'Responsibility in every step', body: 'We believe in responsible product development, clear usage guidance, and helping customers make informed hair care choices.' },
  { icon: Eye, title: 'Transparency without compromise', body: 'We value honest communication, clear product information, and realistic expectations. Your trust will always matter more than an exaggerated promise.' },
  { icon: Scale, title: 'Integrity above everything', body: 'A brand is not defined only by what it sells, but by the values it stands for and the responsibility it carries.' },
];

const AFTER = [
  { t: 'No compulsory repurchase', b: 'Once you complete your initial three months, you are not required to purchase another complete kit.' },
  { t: 'Buy only what you need', b: 'If you require shampoo, oil or maintenance products, you can purchase them occasionally according to your needs.' },
  { t: 'No pressure to continue', b: "If you haven't noticed the improvement you expected after three months, you don't have to purchase another month's kit." },
  { t: 'One year of complimentary guidance', b: 'Even after your initial product journey, we continue guiding you for the next 12 months at absolutely no additional consultation or guidance cost.' },
];

export default function Commitment() {
  return (
    <>
      <PageHero eyebrow="Our commitment" title="Beyond beauty. Built on trust." subtitle="At Quench Elegance, we believe that true elegance begins with responsibility, grows through quality, and lasts through trust." />

      <section className="section">
        <div className="container">
          <div className="values-grid">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} className="value-card" delay={i * 80}>
                <v.icon size={26} />
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section dark-section">
        <div className="container split">
          <div className="split-text">
            <span className="eyebrow light">Our commitment doesn't end after three months</span>
            <h2>We believe in your hair journey, not just your purchase.</h2>
            <p>
              We don't believe customers should be pressured into purchasing products month after month. We encourage an initial three-month hair-care journey, giving
              you time to follow a consistent routine and understand your hair and scalp needs.
            </p>
            <p className="muted-light">And what happens after three months?</p>
          </div>
          <div className="after-list">
            {AFTER.map((a, i) => (
              <Reveal key={a.t} className="after-item" delay={i * 80}>
                <CheckCircle2 size={22} />
                <div><h3>{a.t}</h3><p>{a.b}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container narrow">
          <SectionHead center eyebrow="Because hair health is more than applying products" title="We help you understand the root causes." />
          <Reveal className="center-text prose">
            <p>
              We will help you understand the possible factors influencing your hair concerns, including nutrition, lifestyle, scalp condition, daily habits and other
              potential root causes — and guide you on what lifestyle changes, nutritional awareness and hair-care practices may be worth considering. Where necessary,
              we will also encourage appropriate professional medical evaluation.
            </p>
            <p>
              We don't want you to become a customer who keeps buying products without understanding your hair concerns. We want you to become an informed individual
              who understands their hair, makes better decisions and takes responsibility for long-term hair care.
            </p>
          </Reveal>
          <div className="triple-line">
            <span>Three months of product guidance.</span>
            <span>Twelve months of complimentary support.</span>
            <span>A lifetime of hair-care knowledge.</span>
          </div>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <Reveal className="promise-banner">
            <h2>Your trust. Our responsibility. Our purpose.</h2>
            <p>Our journey is driven by one belief: everyone deserves access to quality hair and scalp care, delivered with honesty, thoughtfulness, and care. Thank you for being a part of the Quench Elegance journey.</p>
            <span className="pdp-signature">The journey continues. The commitment remains.</span>
            <Link to="/shop" className="btn btn-gold">Begin your journey</Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
