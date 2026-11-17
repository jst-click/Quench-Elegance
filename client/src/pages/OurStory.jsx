import { Link } from 'react-router-dom';
import { PageHero, Reveal } from '../components/ui';

const FACTORS = ['Nutrition', 'Lifestyle', 'Hormonal factors', 'Genetics', 'Scalp health', 'Environmental exposure', 'Daily habits'];

export default function OurStory() {
  return (
    <>
      <PageHero eyebrow="The story behind Quench Elegance" title="A personal struggle. A powerful discovery. A vision for millions." subtitle="The journey began with a problem I personally experienced." image="/images/founder/mariyappan-g.jpg" />

      <section className="section">
        <div className="container story">
          <Reveal className="story-chapter">
            <span className="story-no">I</span>
            <div>
              <h2>The struggle</h2>
              <p>I am Mariyappan G, a Certified Cosmetologist and the Founder of Quench Elegance.</p>
              <p>
                For years, I personally struggled with hair loss. Like many others, I searched for solutions, explored different products, changed my hair-care routines
                and invested a significant amount of money hoping to see results. Unfortunately, the improvement I expected never came.
              </p>
              <p className="story-pull">“Why are so many people spending money on hair-care solutions without truly understanding what is causing their hair problems?”</p>
            </div>
          </Reveal>

          <Reveal className="story-chapter">
            <span className="story-no">II</span>
            <div>
              <h2>The discovery that changed everything</h2>
              <p>Instead of simply changing products again and again, I decided to understand the science and possible causes behind hair loss.</p>
              <p>My learning journey opened my eyes to something important: hair health is influenced by much more than the products we apply externally.</p>
              <div className="factor-chips">{FACTORS.map((f) => <span key={f}>{f}</span>)}</div>
              <p>
                I realised that people needed more than another bottle of hair oil or shampoo. They needed education, awareness, the right hair-care approach and
                guidance to understand their individual concerns.
              </p>
            </div>
          </Reveal>

          <Reveal className="story-chapter">
            <span className="story-no">III</span>
            <div>
              <h2>Why I created Quench Elegance</h2>
              <p>
                In 2024, I transformed my personal struggle and learning into a purpose-driven vision and founded Quench Elegance in Bengaluru. My intention was simple:
                to build a hair-care brand that goes beyond selling products.
              </p>
              <p>
                A brand that encourages people to understand their hair, make informed decisions, follow consistent care routines and recognise the importance of
                addressing possible underlying factors. By bringing together botanical ingredients, herbal wisdom and active-infused cosmetic formulations, Quench
                Elegance aims to make thoughtful, non-medicated external hair care accessible to more people.
              </p>
            </div>
          </Reveal>

          <Reveal className="story-chapter">
            <span className="story-no">IV</span>
            <div>
              <h2>Every individual deserves a chance to see improvement</h2>
              <p>
                I dream of a future where people do not blindly spend money changing products, where they understand their hair concerns before making decisions, and
                where hair-care education becomes accessible to everyone.
              </p>
              <p>
                I want Quench Elegance to become a trusted name associated with real customer experiences, responsible guidance, product quality and continuous
                improvement. Every individual's hair journey is different. Results cannot be guaranteed, but every customer deserves honest guidance, realistic
                expectations and the right support.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section dark-section">
        <div className="container narrow center-text">
          <span className="eyebrow center light">A message from the founder</span>
          <Reveal as="blockquote" className="big-quote">
            “If my personal struggle could become the reason behind creating something meaningful for millions of people, then that struggle was not in vain. I started
            this journey searching for answers for myself. Today, my dream is to help others understand their hair-care needs and make better choices.”
          </Reveal>
          <p className="big-quote-by">— Mariyappan G, Founder | Quench Elegance</p>
          <p className="story-final">From my personal struggle to a shared vision. <em>This is the story of Quench Elegance.</em></p>
          <Link to="/shop" className="btn btn-gold">Explore the collection</Link>
        </div>
      </section>
    </>
  );
}
