export const siteOrigin = import.meta.env?.VITE_SITE_ORIGIN ?? 'https://nporto.com';
export const routeManifest = [
  { path: '/', title: 'nporto.com | Software Engineer', description: 'Architecture and hands-on development, with experience in technical leadership, MVP delivery, and healthcare informatics. Explore projects and get in touch.', kind: 'home' },
  { path: '/work', title: 'Selected work | nporto.com', description: 'Technical leadership, healthcare knowledge systems, and software delivery across industries. Explore the contributions of Nick Portokallidis.', kind: 'work' },
  { path: '/work/sylva', title: 'SYLVA AG: technical leadership | nporto.com', description: 'Architecture, technical guidance, code review, and hands-on development for an integrated educational platform at SYLVA AG, 2017-2024.', kind: 'case', slug: 'sylva' },
  { path: '/work/carre', title: 'CARRE: structuring healthcare knowledge | nporto.com', description: 'Risk data entry, an educational resources ontology, and educational-data aggregation in the CARRE research project, 2014-2016.', kind: 'case', slug: 'carre' },
  { path: '/work/thrombus-plus', title: 'ThrombUS+: wearable systems research | nporto.com', description: 'Research participation spanning wearable sensor networks, risk estimation, and systems integration. Recorded start: 2024.', kind: 'case', slug: 'thrombus-plus' },
  { path: '/lab/ask-about-my-work', title: 'Ask about my work | nporto.com', description: 'Ask questions about my experience, projects, and publications with optional on-device AI grounded in the public portfolio.', kind: 'ask' },
  { path: '/about', title: 'About | nporto.com', description: 'An engineering practice shaped by mathematics, healthcare informatics, and building software across domains. Education and selected publications.', kind: 'about' },
  { path: '/privacy', title: 'Privacy | nporto.com', description: 'How this static portfolio and its optional local AI experiment handle browsing, questions, and professional contact.', kind: 'privacy' },
] as const;
export const notFoundMeta = { title: 'Page not found | nporto.com', description: 'This page could not be found. Explore selected work or return to the portfolio homepage.' };
