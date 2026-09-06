export type Domain =
  | 'Education'
  | 'Healthcare'
  | 'Sustainability'
  | 'SaaS'
  | 'Media'
  | 'Workplace';

export interface Project {
  slug: string;
  name: string;
  title: string;
  domain: Domain;
  classification: 'professional' | 'research';
  role: string;
  start: number;
  end: number | null;
  dateLabel: string;
  summary: string;
  contribution: string;
  technologies: string[];
  featured: boolean;
  body: string;
  approval: {
    reference: string;
    date: string;
    status: 'approved';
  };
  sourceReference: string;
}

export interface Education {
  dates: string;
  title: string;
  institution: string;
}

export interface Publication {
  title: string;
  authors: string;
  venue: string;
  year: number;
  url?: string;
}
