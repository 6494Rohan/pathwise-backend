import type { ParsedResume, ResumeDetails } from './resumeSchema';

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_EXPERIENCES = 20;
const MAX_EDUCATIONS = 10;
const MAX_SKILLS = 50;

const clip = (value: string | null, maxLength: number): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const monthOrNull = (value: string | null) => (value && YEAR_MONTH.test(value.trim()) ? value.trim() : null);

const distinctSkills = (skills: string[]) => {
  const seen = new Set<string>();
  return skills
    .map((skill) => clip(skill, 100))
    .filter((skill): skill is string => {
      if (!skill || seen.has(skill.toLowerCase())) return false;
      seen.add(skill.toLowerCase());
      return true;
    })
    .slice(0, MAX_SKILLS);
};

// The model's output fits the schema but not always the columns: trim, cap lengths and counts, drop malformed months.
export const cleanResume = (resume: ParsedResume): ResumeDetails => ({
  full_name: clip(resume.full_name, 200),
  email: clip(resume.email, 320),
  phone: clip(resume.phone, 40),
  current_designation: clip(resume.current_designation, 200),
  current_location: clip(resume.current_location, 200),
  skills: distinctSkills(resume.skills),
  experiences: resume.experiences
    .map((job) => ({
      designation: clip(job.designation, 200),
      company_name: clip(job.company_name, 200),
      start_month: monthOrNull(job.start_month),
      end_month: monthOrNull(job.end_month),
      description: clip(job.description, 2000),
    }))
    .filter((job): job is typeof job & { designation: string; company_name: string } => !!job.designation && !!job.company_name)
    .slice(0, MAX_EXPERIENCES),
  educations: resume.educations
    .map((school) => ({
      institution: clip(school.institution, 200),
      degree: clip(school.degree, 200),
      start_month: monthOrNull(school.start_month),
      end_month: monthOrNull(school.end_month),
    }))
    .filter((school): school is typeof school & { institution: string } => !!school.institution)
    .slice(0, MAX_EDUCATIONS),
});

// Nothing usable came out: the file isn't a resume, or its text couldn't be read.
export const isEmptyResume = (resume: ResumeDetails) =>
  !resume.full_name && resume.experiences.length === 0 && resume.educations.length === 0 && resume.skills.length === 0;
