export interface ProfileEntryMonths {
  start_month: string | null;
  end_month: string | null;
}

export interface ExperienceDto extends ProfileEntryMonths {
  id: string;
  designation: string;
  company_name: string;
  description: string | null;
}

export interface EducationDto extends ProfileEntryMonths {
  id: string;
  institution: string;
  degree: string | null;
}

export interface ProfileDto {
  profile_code: string;
  plan: 'guest' | 'pro';
  full_name: string | null;
  email: string | null;
  phone: string | null;
  current_designation: string | null;
  current_location: string | null;
  preferred_locations: string[];
  skills: string[];
  resume: { file_name: string; file_type: 'pdf'; size_bytes: number; uploaded_at: string } | null;
  experiences: ExperienceDto[];
  educations: EducationDto[];
}

export interface ResumeFile {
  key: string;
  fileName: string;
  sizeBytes: number;
}
