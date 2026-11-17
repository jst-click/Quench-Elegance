import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, X, ZoomIn } from 'lucide-react';
import { AWARDS } from '../content';
import { PageHero, Reveal } from '../components/ui';

export default function Awards() {
  const [zoom, setZoom] = useState(null);
  useEffect(() => {
    if (!zoom) return;
    const k = (e) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [zoom]);

  return (
    <>
      <PageHero eyebrow="Awards & recognition" title="Milestones. One vision. A new standard in hair care." subtitle="2026 placed Quench Elegance's preventive hair-care philosophy in the spotlight across Bengaluru, Goa, New Delhi and Mumbai." />

      <section className="section">
        <div className="container timeline">
          {AWARDS.map((a, i) => (
            <Reveal key={a.id} className={`award-row ${i % 2 ? 'flip' : ''}`}>
              <button className="award-img" onClick={() => setZoom(a.image)} aria-label={`Enlarge photo: ${a.title}`}>
                <img src={a.image} alt={a.title} loading="lazy" />
                <span className="zoom-hint"><ZoomIn size={18} /></span>
              </button>
              <div className="award-body">
                <span className="award-no">{a.no}</span>
                <div className="award-meta">
                  <span><MapPin size={14} /> {a.city}</span>
                  <span><CalendarDays size={14} /> {a.date}</span>
                </div>
                <p className="award-event">{a.event}</p>
                <h2>{a.title}</h2>
                <p>{a.body}</p>
                <p className="award-presenter">{a.presenter}{a.organiser ? ` · ${a.organiser}` : ''}</p>
                {a.certificate && (
                  <button className="btn btn-outline btn-sm" onClick={() => setZoom(a.certificate)}>View certificate</button>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section dark-section">
        <div className="container media-grid">
          <Reveal className="media-card">
            <button onClick={() => setZoom('/images/awards/forbes-india-feature.jpg')} aria-label="Enlarge Forbes India feature">
              <img src="/images/awards/forbes-india-feature.jpg" alt="Forbes India feature" loading="lazy" />
            </button>
            <div>
              <span className="eyebrow light">Media</span>
              <h3>Featured in Forbes India</h3>
              <p>“Mariyappan G — Redefining Hair Care Through Root-Cause Wellness.” Recognised for reshaping hair care through a preventive, root-cause approach.</p>
            </div>
          </Reveal>
          <Reveal className="media-card" delay={120}>
            <button onClick={() => setZoom('/images/awards/awards-brochure.jpg')} aria-label="Enlarge awards brochure">
              <img src="/images/awards/awards-brochure.jpg" alt="Three milestones, one vision brochure" loading="lazy" />
            </button>
            <div>
              <span className="eyebrow light">Beyond the awards</span>
              <h3>A long-term vision</h3>
              <p>Recognition is an important milestone, but the larger objective is to build a brand that earns consumer trust through clarity, consistency and responsible hair-care practices.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <button className="icon-btn light lightbox-close" aria-label="Close"><X size={24} /></button>
          <img src={zoom} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
