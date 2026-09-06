import sylvaBody from './sylva.md?raw';
import carreBody from './carre.md?raw';
import thrombusBody from './thrombus-plus.md?raw';
import type { Education, Project, Publication } from './types';

export type { Domain, Education, Project, Publication } from './types';

const approval = {
  reference: 'Owner implementation request, 2026-09-05',
  date: '2026-09-05',
  status: 'approved',
} as const;

export const contact = {
  email: 'portokallidis@gmail.com',
  github: 'https://github.com/portokallidis',
};

export const projects: Project[] = [
  {
    slug: 'sylva',
    name: 'SYLVA AG',
    title: 'Technical leadership for an educational platform',
    domain: 'Education',
    classification: 'professional',
    role: 'Technical Lead',
    start: 2017,
    end: 2024,
    dateLabel: '2017-2024',
    summary:
      'Architecture, technical guidance, and hands-on development for an integrated platform where educators create, teach, test, grade, and manage courses. As Technical Lead, my responsibilities brought together design, code reviews, project planning and estimation, and team leadership throughout my work on the educational platform.',
    contribution:
      'Software architecture, code reviews, project planning, team leadership, and development.',
    technologies: [
      'Angular',
      'Vue',
      'QuasarUI',
      'Docker',
      'Loopback API',
      'MongoDB',
      'BigQuery',
      'Google Cloud',
      'Mathematica',
      'Wolfram Engine',
    ],
    featured: true,
    body: sylvaBody,
    approval,
    sourceReference: 'CV 2025, page 4, Professional Experience: SYLVA AG',
  },
  {
    slug: 'carre',
    name: 'CARRE',
    title: 'Structuring healthcare knowledge and educational resources',
    domain: 'Healthcare',
    classification: 'research',
    role: 'Research contribution',
    start: 2014,
    end: 2016,
    dateLabel: '2014-2016',
    summary:
      'Application and ontology development within research on patient empowerment and shared decision making for cardiorenal disease. At Democritus University of Thrace, I contributed to the Risk Data Entry System V2, Educational Resources Ontology, and Educational Data Aggregator, combining healthcare information modelling with practical software development.',
    contribution:
      'Risk data entry, Educational Resources Ontology, and Educational Data Aggregator.',
    technologies: [
      'HTML5',
      'NodeJS',
      'AngularJS',
      'Docker',
      'Dokku',
      'GruntJS',
      'Gulp',
      'MongoDB',
      'Virtuoso RDF server',
      'SPARQL',
      'OWL',
      'Bioportal API',
      'Jasmine',
    ],
    featured: true,
    body: carreBody,
    approval,
    sourceReference: 'CV 2025, page 2, Research Experience & Projects: CARRE',
  },
  {
    slug: 'thrombus-plus',
    name: 'ThrombUS+',
    title: 'Wearable systems and integration research',
    domain: 'Healthcare',
    classification: 'research',
    role: 'Research participation',
    start: 2024,
    end: null,
    dateLabel: 'Start: 2024',
    summary:
      'Research participation spanning wearable sensor networks, DVT risk-estimation tasks, and system integration. My recorded involvement includes lower-limb activity sensing, wearable integration and signal quality, as well as central intelligence software, communications, security, and privacy. These describe my participation in the research programme, without implying clinical validation.',
    contribution:
      'Participation in wearable-network, risk-estimation, signal-quality, and integration tasks.',
    technologies: [],
    featured: true,
    body: thrombusBody,
    approval,
    sourceReference:
      'CV 2025, pages 1-2, Research Experience & Projects: ThrombUS+',
  },
  {
    slug: 'culcha',
    name: 'Culcha GmbH',
    title: 'From prototype to workplace application',
    domain: 'Workplace',
    classification: 'professional',
    role: 'Developer',
    start: 2020,
    end: 2020,
    dateLabel: '2020',
    summary:
      'Prototyping, proof-of-concept development, and MVP launch for an application focused on behavior and culture change in the workplace.',
    contribution: 'Prototyping, proof of concept, and MVP launch.',
    technologies: ['MaterialUI', 'React', 'Firebase'],
    featured: false,
    body: '',
    approval,
    sourceReference: 'CV 2025, page 4, Professional Experience: Culcha GmbH',
  },
  {
    slug: 'bliss',
    name: 'Bliss by E.ON',
    title: 'Supporting a sustainability application',
    domain: 'Sustainability',
    classification: 'professional',
    role: 'Developer',
    start: 2019,
    end: 2019,
    dateLabel: '2019',
    summary:
      'Bug fixes, maintenance, and extensions for an application promoting renewable energy and sustainability initiatives.',
    contribution: 'Application maintenance, bug fixes, and extensions.',
    technologies: ['MaterialUI', 'Angular 5', 'Docker', 'Loopback API'],
    featured: false,
    body: '',
    approval,
    sourceReference: 'CV 2025, page 4, Professional Experience: Bliss by E.ON',
  },
  {
    slug: 'travojo',
    name: 'Travojo.net',
    title: 'Maintaining travel-receipt software',
    domain: 'SaaS',
    classification: 'professional',
    role: 'Developer',
    start: 2018,
    end: 2019,
    dateLabel: '2018-2019',
    summary:
      'Bug fixes, maintenance, and extensions for a SaaS web application used to manage travel receipts.',
    contribution: 'Maintenance and extensions for travel-receipt SaaS.',
    technologies: [
      'AngularJS',
      'Docker',
      'AutoML',
      'PostgreSQL',
      'Java Tomcat',
      'Bootstrap CSS',
    ],
    featured: false,
    body: '',
    approval,
    sourceReference: 'CV 2025, page 4, Professional Experience: Travojo.net',
  },
  {
    slug: 'pagenews',
    name: 'Pagenews.gr',
    title: 'A frontend connected to real-time news',
    domain: 'Media',
    classification: 'professional',
    role: 'Frontend Developer',
    start: 2016,
    end: 2016,
    dateLabel: '2016',
    summary:
      'Frontend web application development and real-time API integration for a news website.',
    contribution: 'Frontend development and real-time API integration.',
    technologies: ['Socket.io', 'AngularJS'],
    featured: false,
    body: '',
    approval,
    sourceReference: 'CV 2025, page 4, Professional Experience: Pagenews.gr',
  },
  {
    slug: 'naroclips',
    name: 'Naroclips',
    title: 'Making aggregated media easier to explore',
    domain: 'Media',
    classification: 'professional',
    role: 'Developer',
    start: 2016,
    end: 2016,
    dateLabel: '2016',
    summary:
      'MongoDB aggregation-pipeline work and visual analytics for a news and social-media aggregator.',
    contribution: 'Aggregation pipeline and visual analytics.',
    technologies: ['MongoDB', 'Visual analytics', 'Highcharts integration', 'AngularJS'],
    featured: false,
    body: '',
    approval,
    sourceReference: 'CV 2025, pages 4-5, Professional Experience: Naroclips',
  },
  {
    slug: 'electronic-clinical-protocols',
    name: 'Electronic Clinical Protocols',
    title: 'Connecting clinical protocols and semantic information',
    domain: 'Healthcare',
    classification: 'research',
    role: 'Research contribution',
    start: 2014,
    end: 2015,
    dateLabel: '2014-2015',
    summary:
      'Social-network and ontology development for Electronic Clinical Protocols within the Thales Project at the National and Kapodistrian University of Athens.',
    contribution: 'Electronic Clinical Protocols social network and ontology development.',
    technologies: [
      'HTML5',
      'NodeJS',
      'AngularJS',
      'Docker',
      'Dokku',
      'MongoDB',
      'Loopback API',
      'Bioportal API',
      'Pubmed API',
      'OWL',
      'Karma E2E testing',
    ],
    featured: false,
    body: '',
    approval,
    sourceReference: 'CV 2025, page 2, Research Experience & Projects: Thales Project',
  },
];

export const education: Education[] = [
  {
    dates: '2021-2024',
    title: 'M.Sc. in the Internet of Things',
    institution:
      'University of the Aegean, Department of Information and Communication Systems Engineering',
  },
  {
    dates: '2018-2020',
    title: 'M.Sc. in Informatics and Applications',
    institution:
      'University of West Attica, Department of Informatics and Computer Engineering',
  },
  {
    dates: '2004-2014',
    title: 'B.Sc. in Mathematics, Informatics specialization',
    institution: 'University of Ioannina',
  },
  {
    dates: '2021-2022',
    title: 'Certificate in Educational Leadership',
    institution:
      'University of the Aegean, Center for Continuing Education and Lifelong Learning',
  },
];

export const publications: Publication[] = [
  {
    title:
      'Integrated Visualisation of Wearable Sensor Data and Risk Models for Individualised Health Monitoring and Risk Assessment to Promote Patient Empowerment',
    authors: 'Youbing Zhao, Farzad Parvinzamir, N. Portokallidis et al.',
    venue: 'Journal of Visualization',
    year: 2016,
  },
  {
    title:
      'Integrating medical scientific knowledge with the semantically Quantified Self',
    authors:
      'A. Third, G. Gkotsis, E. Kaldoudi, G. Drosatos, N. Portokallidis et al.',
    venue: 'ISWC 2016, 15th International Semantic Web Conference',
    year: 2016,
  },
  {
    title:
      'Capturing Provenance, Evolution and Modification of Clinical Protocols via a Heterogeneous, Semantic Social Network',
    authors: 'N. Portokallidis, G. Drosatos, E. Kaldoudi',
    venue:
      'Social Media & Participatory Health, 13th International Congress in Nursing Informatics',
    year: 2016,
  },
  {
    title: 'An Ontology based Scheme for Formal Care Plan Meta-Description',
    authors: 'E. Kaldoudi, G. Drosatos, N. Portokallidis, A. Third',
    venue:
      'Medicon 2016, XIV Mediterranean Conference on Medical and Biological Engineering and Computing',
    year: 2016,
  },
  {
    title: 'Aggregating Educational Data for Patient Empowerment',
    authors: 'N. Portokallidis, G. Drosatos, E. Kaldoudi',
    venue: 'ELEVIT 2015, 6th Panhellenic Conference on Biomedical Technology',
    year: 2015,
  },
  {
    title: 'Semantic Conceptual Model for Managing Clinical Protocols',
    authors: 'N. Portokallidis, G. Drosatos, E. Kaldoudi',
    venue: 'ELEVIT 2015, 6th Panhellenic Conference on Biomedical Technology',
    year: 2015,
  },
  {
    title:
      'A Dataset for Benchmarking Machine Learning Models for Autonomous Deep Vein Thrombosis Detection Based on Compression Ultrasound Videos',
    authors:
      'Stylianos Didaskalou, Nick Portokallidis, Katerina Tzatzimaki et al.',
    venue:
      'BIOSTEC 2026, 19th International Joint Conference on Biomedical Engineering Systems and Technologies, Volume 4: HEALTHINF, pp. 853-862',
    year: 2026,
    url: 'https://doi.org/10.5220/0014741500004070',
  },
  {
    title:
      'A Comprehensive Infrastructure and Methodology for Multi-Modal Data Acquisition to Empower AI-Based Rehabilitation',
    authors:
      'Katerina Tzatzimaki, Nick Portokallidis, George Drosatos, Eleni Kaldoudi, Stylianos Didaskalou',
    venue:
      'BIOSTEC 2026, 19th International Joint Conference on Biomedical Engineering Systems and Technologies, Volume 3: HEALTHINF, pp. 269-278',
    year: 2026,
    url: 'https://doi.org/10.5220/0014351200004070',
  },
  {
    title:
      'ThrombUS+ Project: Toward Wearable Continuous Point-of-Care Monitoring for Deep Vein Thrombosis of the Lower Limb',
    authors:
      'Vaidotas Marozas, Stylianos Didaskalou, Rimvydas Eitminavičius, Nick Portokallidis et al.',
    venue:
      'Computational and Structural Biotechnology Journal, 35(2), Article 0082',
    year: 2026,
    url: 'https://doi.org/10.34133/csbj.0082',
  },
];

export const about: { intro: string; paragraphs: string[] } = {
  intro:
    'I work across software architecture and hands-on delivery, with depth in healthcare informatics and experience across education, SaaS, sustainability, workplace software, and media.',
  paragraphs: [
    'My work has ranged from technical leadership for an educational platform to research contributions in healthcare knowledge representation, educational-data aggregation, clinical protocols, and wearable systems. I am interested in the point where a complex domain becomes software people can use.',
    'At SYLVA AG, I combined architecture and development with code reviews, planning, and technical guidance. Earlier work on CARRE and Electronic Clinical Protocols brought application development together with ontologies, linked data, and healthcare information.',
    'My background in mathematics and postgraduate study in informatics and the Internet of Things supports work across applications, information models, and connected systems. Earlier educational projects, Lexikratis and Arithmosthenis, involved software and voice-over infrastructure for children with dyslexia and mathematical learning difficulties.',
  ],
};
