import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, FlaskConical, Instagram, Leaf, Lightbulb, ShieldCheck, Infinity as InfinityIcon, IndianRupee, Users, Sparkles, Quote } from 'lucide-react';
import { api } from '../api';
import { AWARDS, BRAND, WHY } from '../content';
import { ProductCard, Reveal, SectionHead } from '../components/ui';
import ComboCard from '../components/ComboCard';

const WHY_ICONS = { Lightbulb, ShieldCheck, Infinity: InfinityIcon, IndianRupee, Users };

export default function Home() {
  const [products, setProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  useEffect(() => {
    api.get('/api/products').then((d) => setProducts(d.products)).catch(() => {});
    api.get('/api/combos?featured=true').then((d) => setCombos(d.combos)).catch(() => {});
  }, []);
  const featured = products.filter((p) => p.featured).slice(0, 4);
  const showcase = featured.length ? featured : products.slice(0, 4);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div className="hero-sheen" aria-hidden="true" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Award-winning hair care · Bengaluru</span>
            <h1>
              Luxury,<br />
              <em>strand by strand.</em>
            </h1>
            <p className="hero-lead">
              Botanical wisdom meets active-infused cosmetic science. Thoughtfully formulated hair and scalp care — with honest guidance
              that stays with you long after your purchase.
            </p>
            <div className="hero-ctas">
              <Link to="/shop" className="btn btn-primary">Shop the collection <ArrowRight size={16} /></Link>
              <Link to="/our-story" className="btn btn-outline">Our story</Link>
            </div>
            <dl className="hero-stats">
              <div><dt>4</dt><dd>National honours in 2026</dd></div>
              <div><dt>62+</dt><dd>Botanicals in Aurelia</dd></div>
              <div><dt>12</dt><dd>Months of free guidance</dd></div>
            </dl>
          </div>

          <div className="hero-visual">
            <div className="hero-arch">
              <div className="hero-arch-inner">
                <img src="/uploads/products/aurelia-hair-elixir.jpg" alt="Aurelia Hair Elixir by Quench Elegance" className="hero-product" />
              </div>
            </div>
            <div className="hero-side hero-side-1">
              <img src="/uploads/products/scalp-elixir.jpg" alt="Scalp Elixir" />
            </div>
            <div className="hero-side hero-side-2">
              <img src="/uploads/products/hair-renaissance.jpg" alt="Hair Renaissance" />
            </div>
            <div className="float-card float-a">
              <Award size={20} />
              <div><strong>Luxury Hair Care Brand</strong><span>of the Year 2026</span></div>
            </div>
            <div className="float-card float-b">
              <Sparkles size={20} />
              <div><strong>Featured in</strong><span>Forbes India</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- MARQUEE ---------- */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <div className="marquee-group" key={k}>
              {['Active-Infused', 'Botanical', 'Herbal', 'Nourishing', 'Daily Care', 'Prevention', 'Care', 'Confidence'].map((w) => (
                <span key={w}>{w}<i>✦</i></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- BESTSELLERS ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-row">
            <SectionHead eyebrow="The Collection" title="Signature rituals for hair & scalp" text="Seven thoughtfully developed formulations — from botanical oils to advanced active serums." />
            <Link to="/shop" className="btn btn-outline hide-sm">View all products</Link>
          </div>
          <div className="product-grid">
            {showcase.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}><ProductCard product={p} /></Reveal>
            ))}
            {!products.length && Array.from({ length: 4 }).map((_, i) => <div key={i} className="product-skeleton" />)}
          </div>
          <div className="center-cta show-sm"><Link to="/shop" className="btn btn-outline">View all products</Link></div>
        </div>
      </section>

      {/* ---------- COMBO KITS ---------- */}
      {combos.length > 0 && (
        <section className="section kits-section" id="kits">
          <div className="container">
            <SectionHead
              center
              eyebrow="Signature Kits · Save up to 57%"
              title="Complete rituals, thoughtfully paired"
              text="Our formulations brought together as step-by-step routines — everything your hair and scalp need, at a special kit price."
            />
            <div className="combo-grid">
              {combos.map((c, i) => <Reveal key={c.id} delay={i * 90}><ComboCard combo={c} /></Reveal>)}
            </div>
          </div>
        </section>
      )}

      {/* ---------- PHILOSOPHY ---------- */}
      <section className="section philosophy">
        <div className="container philosophy-inner">
          <Reveal className="philosophy-text">
            <span className="eyebrow">Our philosophy</span>
            <h2>Where science meets nature,<br /><em>care meets confidence.</em></h2>
            <p>
              Hair care is not just about appearance. It is about understanding the scalp, choosing the right care, and building healthy habits that last.
              Every Quench Elegance formulation brings together the richness of botanical and herbal ingredients with modern, active-infused cosmetic science.
            </p>
            <blockquote>“We believe everyone deserves healthy-looking hair, a comfortable scalp, and the confidence that comes with caring for themselves.”</blockquote>
            <Link to="/about" className="btn btn-primary">Discover Quench Elegance</Link>
          </Reveal>
          <div className="pillars">
            {[
              { icon: Leaf, title: 'Botanical wisdom', body: 'Rosemary, Bhringraj, Amla, Hibiscus, Neem and dozens more — drawn from traditional Indian hair-care heritage.' },
              { icon: FlaskConical, title: 'Active-infused science', body: 'Specialised cosmetic actives like Procapil™, Redensyl®, Anagain™, Caffeine and amino acids for advanced scalp care.' },
              { icon: ShieldCheck, title: 'Honest guidance', body: 'Realistic expectations, clear usage guidance and informed choices. Your trust matters more than an exaggerated promise.' },
            ].map((p, i) => (
              <Reveal key={p.title} className="pillar" delay={i * 100}>
                <span className="pillar-icon"><p.icon size={22} /></span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- AWARDS ---------- */}
      <section className="section dark-section awards-band">
        <div className="container">
          <SectionHead center light eyebrow="Recognition · 2026" title="Milestones. One vision." text="A new standard in hair care — recognised across Bengaluru, Goa, New Delhi and Mumbai." />
          <div className="award-strip">
            {AWARDS.map((a, i) => (
              <Reveal key={a.id} className="award-mini" delay={i * 90}>
                <div className="award-mini-img"><img src={a.image} alt={a.title} loading="lazy" /></div>
                <div className="award-mini-body">
                  <span className="award-mini-meta">{a.city} · {a.date}</span>
                  <h3>{a.title}</h3>
                  <p>{a.event}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="center-cta"><Link to="/awards" className="btn btn-ghost-light">See all recognition <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      {/* ---------- FOUNDER ---------- */}
      <section className="section">
        <div className="container founder-teaser">
          <Reveal className="founder-photo">
            <img src="/images/founder/mariyappan-g.jpg" alt="Mariyappan G, Founder of Quench Elegance" loading="lazy" />
            <div className="founder-photo-tag"><strong>Mariyappan G</strong><span>Founder · Certified Cosmetologist</span></div>
          </Reveal>
          <Reveal className="founder-copy" delay={120}>
            <span className="eyebrow">A personal struggle. A powerful discovery.</span>
            <h2>Built from a question every hair-loss sufferer has asked.</h2>
            <Quote className="quote-mark" size={44} />
            <p className="founder-quote">
              “Why are so many people spending money on hair-care solutions without truly understanding what is causing their hair problems?”
            </p>
            <p>
              After years of personally struggling with hair loss, Mariyappan G — a certified cosmetologist with a background in Nutrition and Dietetics —
              founded Quench Elegance in Bengaluru in 2024 to build a brand that goes beyond selling products: one that educates, guides and earns trust.
            </p>
            <div className="founder-ctas">
              <Link to="/our-story" className="btn btn-primary">Read the story</Link>
              <Link to="/founder" className="btn-link">Founder's message</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- JOURNEY PROMISE ---------- */}
      <section className="section promise">
        <div className="container">
          <SectionHead center eyebrow="Our commitment doesn't end after three months" title="We believe in your hair journey, not just your purchase." />
          <div className="promise-grid">
            {[
              { n: '3', u: 'Months', t: 'Of product guidance', b: 'An initial three-month journey to follow a consistent routine and understand your hair and scalp needs.' },
              { n: '12', u: 'Months', t: 'Of complimentary support', b: 'Guidance on nutrition, lifestyle, scalp condition and habits — at no additional consultation cost.' },
              { n: '∞', u: 'Lifetime', t: 'Of hair-care knowledge', b: 'No compulsory repurchase. Buy only what you need. We want informed customers, not dependent ones.' },
            ].map((s, i) => (
              <Reveal key={s.t} className="promise-card" delay={i * 100}>
                <div className="promise-num">{s.n}<span>{s.u}</span></div>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </Reveal>
            ))}
          </div>
          <p className="promise-sig">Quench Elegance — We don't just want to earn your purchase. <em>We want to earn your trust.</em></p>
        </div>
      </section>

      {/* ---------- WHY ---------- */}
      <section className="section why">
        <div className="container why-inner">
          <div className="why-head">
            <SectionHead eyebrow="Why Quench Elegance?" title="Not simply selling a beauty aspiration." text="We encourage you to understand your hair-care needs and make better-informed choices — from scalp condition and daily habits to nutrition and environment." />
          </div>
          <div className="why-list">
            {WHY.map((w, i) => {
              const Icon = WHY_ICONS[w.icon];
              return (
                <Reveal key={w.title} className="why-item" delay={i * 70}>
                  <span className="why-icon"><Icon size={20} /></span>
                  <div><h3>{w.title}</h3><p>{w.body}</p></div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- EDUCATION ---------- */}
      <section className="section">
        <div className="container">
          <Reveal className="edu-banner">
            <div>
              <span className="eyebrow light">Hair-care education</span>
              <h2>Know the cost. Understand the process. Choose wisely.</h2>
              <p>An informed look at PRP, GFC, exosomes, mesotherapy and hair transplants — procedures, indicative costs in India and the long-term commitment involved.</p>
            </div>
            <Link to="/hair-education" className="btn btn-gold">Read the guide <ArrowRight size={16} /></Link>
          </Reveal>
        </div>
      </section>

      {/* ---------- INSTAGRAM ---------- */}
      <section className="section insta">
        <div className="container insta-inner">
          <div>
            <span className="eyebrow">Join the community</span>
            <h2>Follow our journey {BRAND.instagramHandle}</h2>
            <p>Hair-care tips, real routines, product rituals and behind-the-scenes from the Quench Elegance team.</p>
          </div>
          <a href={BRAND.instagram} target="_blank" rel="noreferrer" className="btn btn-primary"><Instagram size={18} /> Follow on Instagram</a>
        </div>
      </section>
    </>
  );
}
