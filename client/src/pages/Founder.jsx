import { Link } from 'react-router-dom';
import { Award, GraduationCap, Newspaper } from 'lucide-react';
import { PageHero, Reveal } from '../components/ui';

export default function Founder() {
  return (
    <>
      <PageHero eyebrow="Founder's message" title="Care with purpose. Confidence with elegance." subtitle="Mariyappan G — Founder, Quench Elegance · Certified Cosmetologist · Nutrition and Dietetics" />

      <section className="section">
        <div className="container founder-letter">
          <Reveal className="founder-card">
            <img src="/images/founder/mariyappan-g.jpg" alt="Mariyappan G" />
            <div className="founder-card-body">
              <h3>Mariyappan G</h3>
              <span>Founder | Quench Elegance</span>
              <ul>
                <li><GraduationCap size={16} /> Certified Cosmetologist</li>
                <li><GraduationCap size={16} /> Nutrition and Dietetics</li>
                <li><Award size={16} /> Atal Bharat Gaurav Sammaan 2026</li>
                <li><Newspaper size={16} /> Featured in Forbes India</li>
              </ul>
            </div>
          </Reveal>

          <Reveal className="letter" delay={120}>
            <p className="letter-open">At Quench Elegance, my vision began with a simple belief: everyone deserves the confidence that comes with healthy-looking hair and a well-cared-for scalp.</p>
            <p>
              Today, hair fall and scalp concerns have become common challenges, affecting not only our appearance but also our confidence and self-esteem. I believe
              that hair care should go beyond temporary solutions. It should begin with understanding the scalp, choosing the right care, and building a consistent
              routine.
            </p>
            <p>
              As a certified cosmetologist with a background in Nutrition and Dietetics, I envisioned Quench Elegance as a brand that brings together botanical wisdom,
              thoughtfully selected active ingredients, and a modern approach to hair and scalp care.
            </p>
            <p>
              Our purpose is not merely to offer products, but to make quality hair care more accessible, encourage informed choices, and help people feel confident in
              their hair care journey. We are committed to product quality, responsible formulation, affordability, and continuous improvement.
            </p>
            <p>
              For me, Quench Elegance is more than a brand. It is a vision built on trust, a commitment to care, and a journey towards making better hair care accessible
              to everyone.
            </p>
            <p>
              Thank you for being a part of our journey and for placing your trust in Quench Elegance. Your confidence inspires us to keep learning, improving, and moving
              forward.
            </p>
            <div className="letter-sign">
              <span>With gratitude and commitment,</span>
              <strong>Mariyappan G</strong>
              <em>Founder, Quench Elegance</em>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <Reveal className="forbes-feature">
            <img src="/images/awards/forbes-india-feature.jpg" alt="Forbes India feature on Mariyappan G" loading="lazy" />
            <div>
              <span className="eyebrow">As featured in Forbes India</span>
              <h2>Mariyappan G — Redefining Hair Care Through Root-Cause Wellness</h2>
              <p>“Mariyappan G, founder of Quench Elegance, is reshaping hair care through a preventive, root-cause approach…”</p>
              <Link to="/awards" className="btn btn-primary">View awards & recognition</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
