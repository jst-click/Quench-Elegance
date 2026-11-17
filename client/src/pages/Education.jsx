import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { TREATMENTS } from '../content';
import { PageHero, Reveal, SectionHead } from '../components/ui';

const PLAN_COSTS = [
  'Initial consultation and scalp assessment',
  'Recommended laboratory investigations, where appropriate',
  'Multiple treatment sessions',
  'Post-procedure care and maintenance products',
  'Follow-up appointments and ongoing maintenance',
  'Additional expenses depending on individual requirements',
];

const TRANSPLANT_COSTS = [
  'Initial consultation and scalp assessment',
  'Pre-procedure investigations, if required',
  'Hair transplantation procedure and graft charges',
  'Prescribed post-procedure medications',
  'Specialised post-transplant shampoos and scalp-care products',
  'Follow-up consultations and recovery monitoring',
  'Additional maintenance treatments, if recommended',
  'Future hair-care expenses to maintain overall scalp and existing hair health',
];

export default function Education() {
  return (
    <>
      <PageHero eyebrow="Quench Elegance · Hair care education" title="Understanding professional hair-loss treatments" subtitle="An informed look at procedures, estimated costs, evidence and the long-term commitment involved." />

      <section className="section">
        <div className="container">
          <SectionHead eyebrow="A quick guide" title="Procedures & indicative costs in India" text="Indicative private-clinic prices in India; actual costs vary by clinic, formulation, city and treatment plan." />
          <Reveal className="table-wrap">
            <table className="edu-table">
              <thead><tr><th>Treatment</th><th>What it involves</th><th>Indicative cost in India</th></tr></thead>
              <tbody>
                {TREATMENTS.map((t) => (
                  <tr key={t.name}><th scope="row">{t.name}</th><td>{t.what}</td><td className="nowrap">{t.cost}</td></tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container edu-two">
          <Reveal className="edu-card">
            <span className="eyebrow">Understand the complete investment</span>
            <h2>The cost isn't always limited to a single session.</h2>
            <p>
              Many treatment plans involve multiple sessions over a period of time. For example, if a plan includes six sessions, the total procedure cost could range
              approximately from <strong>₹30,000 to ₹1,00,000 or more</strong>, depending on the treatment selected. Certain advanced procedures may cost considerably more.
            </p>
            <h3><ClipboardList size={18} /> Your total budget may also include</h3>
            <ul className="check-list">{PLAN_COSTS.map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="edu-callout">Think beyond the first session. Understand the complete treatment plan, estimated total expenditure, expected outcomes, limitations and ongoing maintenance requirements.</p>
          </Reveal>

          <Reveal className="edu-card" delay={120}>
            <span className="eyebrow">Hair transplant</span>
            <h2>A financial commitment that deserves careful consideration.</h2>
            <p>
              In India, hair transplantation is commonly priced by the number of grafts, the technique and the provider. An estimated 2,000–3,000 graft procedure may cost
              approximately <strong>₹60,000 to ₹2,25,000 or more</strong>. Premium techniques and individual requirements may increase the overall expenditure.
            </p>
            <h3><ClipboardList size={18} /> The cost doesn't end with the procedure</h3>
            <ul className="check-list">{TRANSPLANT_COSTS.map((c) => <li key={c}>{c}</li>)}</ul>
            <p className="edu-callout">
              A transplant addresses specific areas of hair restoration, but it does not automatically stop ongoing hair loss in non-transplanted areas. Understand your
              existing hair condition, donor-area limitations, long-term expectations and maintenance requirements first.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section dark-section">
        <div className="container narrow center-text">
          <Reveal as="blockquote" className="big-quote">“Hair restoration is a decision. Understanding its complete financial and long-term commitment is wisdom.”</Reveal>
          <p className="story-final">Know the cost. Understand the process. <em>Choose wisely.</em></p>
          <p className="muted-light">
            At Quench Elegance, we believe hair-care awareness should begin with knowledge, realistic expectations and informed choices — not just a treatment or a product.
          </p>
          <div className="hero-ctas center"><Link to="/contact" className="btn btn-gold">Talk to our team</Link><Link to="/shop" className="btn btn-ghost-light">Explore products</Link></div>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container narrow">
          <div className="disclaimer">
            <AlertTriangle size={20} />
            <p>
              <strong>Disclaimer:</strong> Costs mentioned are indicative market estimates in India, not quotations. Actual expenditure varies according to treatment,
              graft count, technique, provider, location and additional requirements. This page is for educational awareness and is not a substitute for professional
              medical consultation.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
