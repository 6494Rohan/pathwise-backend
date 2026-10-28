import { cleanResume } from '../resumeCleaner';
import type { ParsedResume } from '../resumeSchema';

const parsed = (overrides: Partial<ParsedResume> = {}): ParsedResume => ({
  is_resume: true,
  full_name: '  Aarav Menon ',
  email: 'aarav@example.com',
  phone: null,
  current_designation: 'ML Intern',
  current_location: '',
  skills: ['Python', 'python', ' SQL ', ''],
  experiences: [
    { designation: 'ML Intern', company_name: 'Northwind', start_month: '2026-01', end_month: 'present', description: ' Built models. ' },
    { designation: ' ', company_name: 'Nameless', start_month: null, end_month: null, description: null },
  ],
  educations: [{ institution: 'UMass Amherst', degree: 'M.S.', start_month: '2024-13', end_month: '2026-05' }],
  ...overrides,
});

describe('cleanResume', () => {
  it('trims text, turns blanks into null and drops the is_resume flag', () => {
    const resume = cleanResume(parsed());

    expect(resume).not.toHaveProperty('is_resume');
    expect(resume.full_name).toBe('Aarav Menon');
    expect(resume.current_location).toBeNull();
  });

  it('keeps distinct skills case-insensitively', () => {
    expect(cleanResume(parsed()).skills).toEqual(['Python', 'SQL']);
  });

  it('keeps only valid YYYY-MM months and drops entries without a title', () => {
    const resume = cleanResume(parsed());

    expect(resume.experiences).toEqual([
      { designation: 'ML Intern', company_name: 'Northwind', start_month: '2026-01', end_month: null, description: 'Built models.' },
    ]);
    expect(resume.educations[0]).toEqual(expect.objectContaining({ start_month: null, end_month: '2026-05' }));
  });

  it('caps lengths and counts to fit the columns', () => {
    const job = { designation: 'Dev', company_name: 'Acme', start_month: null, end_month: null, description: null };
    const resume = cleanResume(
      parsed({ full_name: 'x'.repeat(500), skills: Array.from({ length: 80 }, (_, i) => `skill${i}`), experiences: Array(30).fill(job) })
    );

    expect(resume.full_name).toHaveLength(200);
    expect(resume.skills).toHaveLength(50);
    expect(resume.experiences).toHaveLength(20);
  });
});
