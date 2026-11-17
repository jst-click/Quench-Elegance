import { Link } from 'react-router-dom';
import { Eye, Target, Handshake, Sparkles } from 'lucide-react';
import { PageHero, Reveal } from '../components/ui';

export default function About() {
  return (
    <>
      <PageHero eyebrow="About us" title="Redefining hair care through elegance, innovation & care" subtitle="A hair and skin care brand founded in 2024 in Bengaluru, Karnataka — with a vision to make premium self-care accessible, meaningful and affordable." image="/images/brand/brand-banner.jpg" />

      <section className="section">
        <div className="container split">
          <Reveal className="split-text">
            <span className="eyebrow">Who we are</span>
            <h2>Personal care is an expression of confidence.</h2>
            <p>
              Quench Elegance is a hair and skin care brand founded in 2024 in Bengaluru, Karnataka. We believe that personal care is more than a routine — it is an
              expression of confidence, self-respect, and the way we choose to care for ourselves.
            </p>
            <p>
              Our brand combines the richness of botanical and herbal ingredients with active-infused formulations to create thoughtfully developed products for
              everyday hair and scalp care. Our philosophy focuses on scalp conditioning, nourishment, hydration, hair-fibre care, and maintaining a healthy-looking
              appearance through consistent personal care.
            </p>
            <p>
              At Quench Elegance, we believe that true elegance begins with self-care. Every product in our range reflects our commitment to quality, thoughtful product
              selection, customer satisfaction and a premium experience — bringing together the wisdom of traditional ingredients and modern cosmetic science.
            </p>
          </Reveal>
          <Reveal className="split-media collage" delay={120}>
            <img src="/uploads/products/lumiere-scalp-cream.jpg" alt="Lumière scalp cream" />
            <img src="/uploads/products/aurelia-hair-elixir.jpg" alt="Aurelia Hair Elixir" />
            <img src="/uploads/products/velvera-hair-butter.jpg" alt="Velvera Hair Butter" />
          </Reveal>
        </div>
      </section>

      <section className="section dark-section">
        <div className="container vm-grid">
          <Reveal className="vm-card">
            <Eye size={28} />
            <h3>Our Vision</h3>
            <p>To become one of India's most trusted and admired affordable luxury hair and skin care brands, making quality personal care accessible to more people — because healthy hair should never be a luxury.</p>
          </Reveal>
          <Reveal className="vm-card" delay={120}>
            <Target size={28} />
            <h3>Our Mission</h3>
            <p>To empower individuals with thoughtfully formulated personal care products, encourage consistent self-care practices, and build lasting relationships through transparency, quality and customer-focused service.</p>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container split reverse">
          <Reveal className="split-text">
            <span className="eyebrow">Beyond beauty — creating opportunities</span>
            <h2>A platform for people with ambition.</h2>
            <p>
              Quench Elegance is more than a personal care brand. We are building a platform for individuals who aspire to grow, develop business skills, and create
              income opportunities through brand promotion and affiliate marketing.
            </p>
            <p>
              We believe that ambition deserves an opportunity, and that financial background should never define a person's potential. Our aim is to encourage a
              community of passionate individuals who grow alongside the brand, learn through experience, and contribute to a shared vision of success.
            </p>
            <Link to="/contact" className="btn btn-primary">Partner with us</Link>
          </Reveal>
          <Reveal className="opportunity-card" delay={120}>
            <Handshake size={34} />
            <h3>Ready to build your future?</h3>
            <p>Take the first step, develop your idea and turn your ambition into opportunity with Quench Elegance.</p>
            <ul>
              <li>Brand promotion & affiliate opportunities</li>
              <li>Practical guidance and entrepreneurial confidence</li>
              <li>Skills, self-reliance and income-generating pathways</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <Reveal className="promise-banner">
            <Sparkles size={26} />
            <h2>Our Promise</h2>
            <p>
              We are committed to growing with integrity, improving the customer experience, and making every interaction with Quench Elegance meaningful. Our journey
              is driven by a simple belief: luxury should feel personal, quality should inspire trust, and opportunity should open doors.
            </p>
            <span className="pdp-signature">Quench Elegance — Where Science Meets Nature, Care Meets Confidence, and Ambition Meets Opportunity.</span>
          </Reveal>
        </div>
      </section>
    </>
  );
}
