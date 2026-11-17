export const BRAND = {
  name: 'Quench Elegance',
  tagline: 'Luxury Hair Care. Affordable for Everyone.',
  signature: 'Care with Purpose. Confidence with Elegance.',
  phone: '+91 81235 67808',
  phoneRaw: '918123567808',
  email: 'info@quenchelegance.com',
  website: 'www.quenchelegance.com',
  address: 'No. 58/1, 12th Main Road, Shakambari Nagar, J.P. Nagar 1st Phase, Bengaluru, Karnataka – 560078',
  instagram: 'https://www.instagram.com/quenchelegance',
  instagramHandle: '@quenchelegance',
};

export const whatsappLink = (text = 'Hello Quench Elegance, I would like to know more.') =>
  `https://wa.me/${BRAND.phoneRaw}?text=${encodeURIComponent(text)}`;

export const AWARDS = [
  {
    id: 'bengaluru',
    no: '01',
    event: 'Evolving South India Business Excellence Awards 2026',
    title: 'Excellence in Non-Invasive Skin, Hair & Scalp Restoration',
    city: 'Bengaluru',
    date: '21 February 2026',
    presenter: 'Presented by Saina Nehwal',
    organiser: 'Organised by PrestigeSphere PR',
    image: '/images/awards/bengaluru-2026.jpg',
    body: "Quench Elegance's first highlighted milestone. The recognition celebrates the brand's focus on non-invasive personal-care approaches and its emphasis on prevention, awareness and structured hair-care guidance.",
  },
  {
    id: 'goa',
    no: '02',
    event: 'Awards Trust of India — International Conferment Ceremony 2026',
    title: 'Atal Bharat Gaurav Sammaan',
    city: 'Goa',
    date: '04 April 2026',
    presenter: 'Presented by Dr. Roshankumar Palewar & Dr. H.E.M.N. Sardar Ali',
    organiser: 'Excellence in Non-Invasive Hair & Skin Care Products',
    image: '/images/awards/goa-conferment-2026.jpg',
    certificate: '/images/awards/atal-bharat-gaurav-sammaan.jpg',
    body: 'Conferred on Mariyappan G in recognition of professional achievement and dedication in the field of non-invasive hair and skin care products — presented by Dr. Roshankumar Palewar, Pharmaceutical Strategy & Policy Leader, and Dr. H.E.M.N. Sardar Ali, Founder, International Chamber of Agriculture.',
  },
  {
    id: 'delhi',
    no: '03',
    event: 'International Business & Education Awards 2026',
    title: 'Best Haircare Award — Quench Elegance',
    city: 'New Delhi',
    date: '11 April 2026',
    presenter: 'Presented by Suresh Raina',
    organiser: 'Organised by Kiteskraft Productions LLP',
    image: '/images/awards/new-delhi-2026.jpg',
    body: "Another chapter in the brand's journey, reflecting its ambition to make hair care more accessible and to encourage consumers to move beyond temporary fixes towards informed, consistent routines.",
  },
  {
    id: 'mumbai',
    no: '04',
    event: 'Luxury Lifestyle & Business Awards 2026',
    title: 'Luxury Hair Care Brand of the Year — Quench Elegance',
    city: 'Mumbai',
    date: '30 September 2026',
    presenter: 'Presented by Kiara Advani',
    organiser: '',
    image: '/images/awards/mumbai-2026.jpg',
    body: "The Mumbai milestone reinforces the brand's positioning at the intersection of personal care, accessible luxury and entrepreneurial ambition.",
  },
];

export const WHY = [
  { icon: 'Lightbulb', title: 'Problem-first approach', body: 'We start by understanding your hair and scalp concern — not by pushing a product.' },
  { icon: 'ShieldCheck', title: 'Structured guidance', body: 'Clear routines and usage guidance so every step has a purpose.' },
  { icon: 'Infinity', title: 'Long-term orientation', body: 'Hair health is built through consistency, not quick fixes.' },
  { icon: 'IndianRupee', title: 'Affordable solutions', body: 'Premium formulations priced so quality care is accessible to more people.' },
  { icon: 'Users', title: 'Continued support', body: '12 months of complimentary guidance, even after your product journey.' },
];

export const TREATMENTS = [
  { name: 'PRP', what: "Platelets are concentrated from the patient's blood and injected into the scalp.", cost: '₹4,000 – ₹10,000 / session' },
  { name: 'GFC', what: 'A blood-derived preparation concentrated for growth-factor scalp injections.', cost: '₹5,000 – ₹15,000 / session' },
  { name: 'Exosome Therapy', what: 'Uses extracellular-vesicle products being investigated for regenerative effects.', cost: '₹15,000 – ₹30,000+ / session' },
  { name: 'QR678 / QR678 Neo', what: 'A proprietary injectable formulation marketed for hair-loss management.', cost: '₹8,000 – ₹20,000 / session' },
  { name: 'Mesotherapy', what: 'Small scalp injections containing substances that vary by protocol.', cost: '₹3,000 – ₹8,000 / session' },
  { name: 'Biotin IV Therapy', what: 'Intravenous vitamin B7 administration under medical supervision.', cost: '₹2,000 – ₹6,000 / session' },
];

export const CATEGORIES = ['Hair Oil', 'Hair Serum', 'Scalp Care', 'Shampoo', 'Conditioner'];
