import { z } from 'zod/v4';

const month = z.string().nullable().describe('YYYY-MM; use -01 when only the year is known; null when not stated');
const text = z.string().nullable();

// Sent to Claude as the structured output format, so the reply can only fill these fields.
export const ParsedResumeSchema = z.object({
  full_name: text,
  email: text,
  phone: text,
  current_designation: text.describe('Job title of the current or most recent role'),
  current_location: text.describe('City, state, country as written on the resume'),
  skills: z.array(z.string()).describe('Distinct skills, most relevant first'),
  experiences: z
    .array(
      z.object({
        designation: z.string(),
        company_name: z.string(),
        start_month: month,
        end_month: month.describe('YYYY-MM; null when the role is current or the end is not stated'),
        description: text.describe('One or two sentences summarising the role'),
      })
    )
    .describe('Newest first'),
  educations: z
    .array(
      z.object({
        institution: z.string(),
        degree: text,
        start_month: month,
        end_month: month,
      })
    )
    .describe('Newest first'),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
export type ResumeDetails = ParsedResume;
