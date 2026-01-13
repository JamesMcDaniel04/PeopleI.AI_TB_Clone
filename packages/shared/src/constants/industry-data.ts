export const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Education',
  'Government',
  'Non-Profit',
  'Energy',
  'Telecommunications',
] as const;

export const JOB_TITLES_BY_DEPARTMENT: Record<string, string[]> = {
  Executive: [
    'Chief Executive Officer',
    'Chief Operating Officer',
    'Chief Financial Officer',
    'Chief Technology Officer',
    'Chief Marketing Officer',
    'Chief Revenue Officer',
    'President',
    'Managing Director',
  ],
  Sales: [
    'VP of Sales',
    'Sales Director',
    'Sales Manager',
    'Account Executive',
    'Business Development Representative',
    'Sales Operations Manager',
  ],
  Marketing: [
    'VP of Marketing',
    'Marketing Director',
    'Marketing Manager',
    'Product Marketing Manager',
    'Digital Marketing Manager',
    'Content Marketing Manager',
  ],
  IT: [
    'VP of Engineering',
    'Director of IT',
    'IT Manager',
    'Solutions Architect',
    'Senior Developer',
    'Systems Administrator',
  ],
  Finance: [
    'VP of Finance',
    'Finance Director',
    'Controller',
    'Financial Analyst',
    'Accounting Manager',
  ],
  Operations: [
    'VP of Operations',
    'Operations Director',
    'Operations Manager',
    'Project Manager',
    'Business Analyst',
  ],
};

export const DEPARTMENTS = [
  'Executive',
  'Sales',
  'Marketing',
  'IT',
  'Finance',
  'Operations',
  'Human Resources',
  'Legal',
  'Customer Success',
] as const;

export const COMPANY_SIZE_RANGES = [
  { label: 'Small', min: 10, max: 50 },
  { label: 'Medium', min: 51, max: 200 },
  { label: 'Large', min: 201, max: 1000 },
  { label: 'Enterprise', min: 1001, max: 10000 },
] as const;

export const ANNUAL_REVENUE_RANGES = [
  { label: 'Small', min: 1000000, max: 10000000 },
  { label: 'Medium', min: 10000001, max: 50000000 },
  { label: 'Large', min: 50000001, max: 500000000 },
  { label: 'Enterprise', min: 500000001, max: 5000000000 },
] as const;

export const DEAL_SIZE_RANGES = [
  { label: 'Small', min: 5000, max: 25000 },
  { label: 'Medium', min: 25001, max: 100000 },
  { label: 'Large', min: 100001, max: 500000 },
  { label: 'Enterprise', min: 500001, max: 2000000 },
] as const;
