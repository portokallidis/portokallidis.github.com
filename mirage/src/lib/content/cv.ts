/**
 * CV content extracted from legacy-portfolio/cv/short_cv.html and
 * legacy-portfolio/cv/index.html. Structured for retrieval by the
 * resume Q&A and the extractive RAG fallback.
 */

export type Experience = {
  company: string;
  role: string;
  start: string;
  end: string;
  url?: string;
  description?: string;
};

export type Education = {
  institution: string;
  degree: string;
  field?: string;
  year?: string;
  notes?: string;
};

export type Project = {
  name: string;
  summary: string;
  url?: string;
  highlights?: string[];
};

export type Certification = {
  name: string;
  issuer: string;
  year?: string;
  notes?: string;
};

export type Publication = {
  title: string;
  authors: string;
  venue: string;
  date: string;
};

export type CV = {
  name: string;
  title: string;
  email: string;
  phone: string;
  website: string;
  cvUrl: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  publications: Publication[];
  skills: Record<string, string[]>;
  languages: Array<{ language: string; level: string }>;
};

export const cv: CV = {
  name: 'Nick Portokallidis',
  title: 'Senior Full-Stack Web Developer',
  email: 'portokallidis@gmail.com',
  phone: '(+30) 6946 985 370',
  website: 'http://nporto.com',
  cvUrl: 'http://nporto.com/cv',
  summary:
    'Senior full-stack developer with deep DevOps and applied AI experience. ' +
    'Built and operated production systems across Node.js, Vue/React/Angular, ' +
    'Postgres/MongoDB/Neo4j, and Docker/Kubernetes stacks. Published researcher ' +
    'in semantic web and medical informatics. Now focused on local-first AI: ' +
    'on-device LLMs, browser-side computer vision, privacy-by-design systems.',
  experience: [
    {
      company: 'SYLVA',
      role: 'Senior Developer',
      start: '2017-01',
      end: 'Present',
      url: 'https://www.sylva.ac',
      description:
        'Senior developer on a national research platform. Full-stack work ' +
        'across Node.js, Vue.js, Postgres, Docker, Kubernetes on AWS.'
    },
    {
      company: 'Democritus University of Thrace — CARRE Project R&D',
      role: 'Research Associate',
      start: '2014-11',
      end: '2016-12',
      url: 'http://www.carre-project.eu',
      description:
        'R&D on semantic web, RDF/SPARQL, linked data, risk-assessment ' +
        'visualisations. Published 6 papers from this work.'
    },
    {
      company: 'Pagenews.gr',
      role: 'Frontend Developer',
      start: '2016-08',
      end: '2016-09',
      url: 'http://www.pagenews.gr'
    },
    {
      company: 'Naroclips.com',
      role: 'Full-Stack Developer / Visual Analytics',
      start: '2016-02',
      end: '2016-06',
      url: 'http://naroclips.com'
    },
    {
      company: 'National and Kapodistrian University of Athens — Thales R&D',
      role: 'Research Associate',
      start: '2014-09',
      end: '2015-09',
      url: 'http://excellence.minedu.gov.gr/thales'
    },
    {
      company: 'University of Ioannina & E.L.E.P.A.P. R&D',
      role: 'Flash Core Developer',
      start: '2009-02',
      end: '2011-05',
      url: 'http://www.elepap.gr/',
      description:
        'Flash applications, PHP aggregator, text-to-speech database.'
    },
    {
      company: 'Freelance / Old Portfolio',
      role: 'Web Developer',
      start: '2009-04',
      end: '2014-08',
      url: 'http://2013.nporto.com',
      description: 'E-shops, websites, web applications.'
    }
  ],
  education: [
    {
      institution: 'University of West Attica',
      degree: "Master's degree (MSc)",
      field: 'Computer Science',
      year: '2011',
      notes: 'GPA: 8.25'
    },
    {
      institution: 'University of Ioannina',
      degree: 'Bachelor',
      field: 'Mathematics, Computer Science minor',
      year: '2007',
      notes:
        'Algorithmic complexity, datastores, Prolog/Lisp, C/Fortran, Java OO basics.'
    }
  ],
  certifications: [
    {
      name: 'Machine Learning with TensorFlow',
      issuer: 'Google Cloud Platform',
      notes:
        'Introduction, practical ML, optimizations, neural networks, feature ' +
        'engineering, deployment.'
    },
    {
      name: 'Machine Learning',
      issuer: 'Stanford University (Online)',
      notes:
        'Linear/logistic regression, neural networks, SVMs, anomaly detection, ' +
        'recommender systems, large-scale ML.'
    }
  ],
  projects: [
    {
      name: 'Mirage: The On-Device AI Guardian',
      summary:
        'This portfolio. Local-first AI demos: face blur, text-region redaction, ' +
        'voice recruiter, security auditor, STRIDE matrix — all running ' +
        'on-device via WebLLM + MediaPipe + Web Workers.',
      highlights: [
        'Privacy guard wrapping fetch/XHR/WS/Beacon/image-src',
        'BlazeFace in a Web Worker with OffscreenCanvas and WebGPU',
        'WebLLM with Hermes-3 8B and Hermes-3-Llama-3.1 8B models',
        'Web Speech API voice loop for the recruiter demo'
      ]
    },
    {
      name: 'CARRE — Risk Assessment Visualisations',
      summary:
        'RDF-driven personalised health-risk visualisations using D3 and ' +
        'SPARQL. Built for the EU CARRE project under FP7.',
      highlights: ['D3', 'SPARQL/RDF', 'BioPortal ontologies (UMLS, SNOMED, ICD)']
    },
    {
      name: 'Evropsyktiki',
      summary: 'Vue.js / Node.js property listings platform with REST API.',
      url: 'https://evropsyktiki.gr'
    },
    {
      name: 'e-ClinPro',
      summary: 'Clinical protocols semantic capture tool for medical informatics.'
    }
  ],
  publications: [
    {
      title: 'Integrated Visualisation of Wearable Sensor Data and Risk Models for Individualised Health Monitoring',
      authors: 'Y. Zhao, F. Parvinzamir, N. Portokallidis et al.',
      venue: 'Journal of Visualization',
      date: '2016-11-04'
    },
    {
      title: 'Integrating Medical Scientific Knowledge with the Semantically Quantified Self',
      authors: 'A. Third, G. Gkotsis, E. Kaldoudi, G. Drosatos, N. Portokallidis et al.',
      venue: 'ISWC 2016',
      date: '2016-08-03'
    },
    {
      title: 'Aggregating Educational Data for Patient Empowerment',
      authors: 'N. Portokallidis, G. Drosatos, E. Kaldoudi',
      venue: 'ELEVIT 2015',
      date: '2015-05-06'
    },
    {
      title: 'Semantic Conceptual Model for Managing Clinical Protocols',
      authors: 'N. Portokallidis, G. Drosatos, E. Kaldoudi',
      venue: 'ELEVIT 2015',
      date: '2015-05-06'
    },
    {
      title: 'An Ontology-based Scheme for Formal Care Plan Meta-Description',
      authors: 'E. Kaldoudi, G. Drosatos, N. Portokallidis, A. Third',
      venue: 'Medicon 2016',
      date: '2016'
    },
    {
      title: 'Capturing Provenance, Evolution and Modification of Clinical Protocols via a Heterogeneous, Semantic Social Network',
      authors: 'N. Portokallidis, G. Drosatos, E. Kaldoudi',
      venue: 'Social Media & Participatory Health, Geneva 2016',
      date: '2016'
    }
  ],
  skills: {
    'Full Stack': ['Loopback.io', 'Strapi.io', 'MeteorJS', 'MEAN stack', 'Firebase', 'SailsJS'],
    Frontend: ['Vue.js', 'React', 'Angular', 'Svelte/SvelteKit', 'Bootstrap', 'jQuery', 'Web Components', 'Vanilla JS'],
    'Visual Analytics': ['D3', 'chart.js', 'vis.js', 'Highcharts'],
    Backend: ['PHP', 'Node.js', 'GraphQL', 'API-Loopback', 'Socket.io', 'Python'],
    Databases: ['MongoDB', 'Neo4j', 'Virtuoso RDF store', 'Postgres', 'SQLite', 'Redis'],
    'Linked Data': ['SPARQL', 'RDF vocabularies', 'OWL ontologies', 'BioPortal: UMLS, SNOMED, ICD'],
    Automation: ['Yeoman generators', 'Gulp', 'Webpack', 'Grunt', 'LinemanJS'],
    Deployment: ['AWS', 'Heroku', 'Ansible', 'Docker', 'Kubernetes', 'Google Cloud', 'IBM Cloud'],
    'Server OS': ['Debian Linux', 'Windows Server', 'Docker-compatible hosts'],
    'JS Testing': ['Mocha', 'Jasmine', 'Karma E2E', 'Vitest', 'Playwright'],
    'AI/ML (browser)': ['WebLLM', 'MediaPipe Tasks Vision', 'Transformers.js', 'ONNX Runtime Web'],
    'AI/ML (server)': ['TensorFlow', 'Limdu.js', 'Octave'],
    Languages: ['TypeScript', 'JavaScript (ES5–ES2024)', 'Python', 'PHP', 'Go (working)', 'SQL', 'Shell']
  },
  languages: [
    { language: 'English', level: 'C2 (Proficiency, ESOL LRN)' },
    { language: 'English', level: 'C1 (IELTS Academic 7.5)' },
    { language: 'English', level: 'B2 (FCE, Cambridge)' },
    { language: 'German', level: 'B1 (Zertifikat, Goethe)' },
    { language: 'Greek', level: 'Native' }
  ]
};

/**
 * Build a single flat string for retrieval. Each chunk starts with a
 * section marker so the extractive RAG can show provenance.
 */
export function cvToChunks(): Array<{ section: string; text: string }> {
  const chunks: Array<{ section: string; text: string }> = [];
  chunks.push({ section: 'summary', text: cv.summary });
  for (const e of cv.experience) {
    chunks.push({
      section: 'experience',
      text: `${e.role} at ${e.company}, ${e.start} to ${e.end}. ${e.description ?? ''}`.trim()
    });
  }
  for (const e of cv.education) {
    chunks.push({
      section: 'education',
      text: `${e.degree} in ${e.field ?? ''} from ${e.institution}${e.year ? ` (${e.year})` : ''}. ${e.notes ?? ''}`.trim()
    });
  }
  for (const c of cv.certifications) {
    chunks.push({
      section: 'certifications',
      text: `${c.name} from ${c.issuer}. ${c.notes ?? ''}`.trim()
    });
  }
  for (const p of cv.projects) {
    chunks.push({ section: 'projects', text: `${p.name}: ${p.summary}` });
  }
  for (const p of cv.publications) {
    chunks.push({
      section: 'publications',
      text: `${p.title} — ${p.authors} — ${p.venue} (${p.date})`
    });
  }
  for (const [cat, items] of Object.entries(cv.skills)) {
    chunks.push({ section: 'skills', text: `${cat}: ${items.join(', ')}` });
  }
  for (const l of cv.languages) {
    chunks.push({ section: 'languages', text: `${l.language}: ${l.level}` });
  }
  return chunks;
}