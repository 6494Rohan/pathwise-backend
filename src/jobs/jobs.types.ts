export interface CompanySummary {
  company_id: string;
  company_name: string;
  logo_url: string | null;
  is_verified: boolean;
}

export interface SkillSummary {
  skill_id: string;
  skill_name: string;
  slug: string;
}

export interface JobListItem {
  job_id: string;
  job_title: string;
  job_type: 'full_time' | 'part_time' | 'internship' | 'contract';
  work_mode: 'on_site' | 'remote' | 'hybrid';
  city: string;
  lat: number;
  lng: number;
  min_experience_years: number;
  max_experience_years: number | null;
  min_ctc_lpa: number | null;
  max_ctc_lpa: number | null;
  posted_at: string;
  distance_km: number | null;
  company: CompanySummary;
  skills: SkillSummary[];
}

export interface JobPage {
  jobs: JobListItem[];
  total: number;
}

export interface JobMapPin {
  company_id: string;
  company_name: string;
  is_verified: boolean;
  city: string;
  lat: number;
  lng: number;
  open_jobs_count: number;
}

export interface SkillOption extends SkillSummary {
  job_count: number;
}

export interface CompanyOption extends Omit<CompanySummary, 'logo_url'> {
  job_count: number;
}

export interface JobFilterOptions {
  skills: SkillOption[];
  companies: CompanyOption[];
}
