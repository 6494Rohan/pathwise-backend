import { z } from 'zod/v4';
import { ParsedResumeSchema } from './resumeSchema';

// Internal call from parseResume (outside the VPC, no database access) to resumeStore (inside the VPC).
export const ResumeStoreRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reserveParse'), userId: z.string().min(1) }),
  z.object({
    action: z.literal('saveParsed'),
    userId: z.string().min(1),
    resume: ParsedResumeSchema,
    file: z.object({ key: z.string().min(1), fileName: z.string().min(1), sizeBytes: z.number().int().positive() }),
  }),
]);

export type ResumeStoreRequest = z.infer<typeof ResumeStoreRequestSchema>;

export const ReserveParseResultSchema = z.object({ allowed: z.boolean() });

export const SaveParsedResultSchema = z.object({
  profile: z.looseObject({ profile_code: z.string() }),
  previousResumeKey: z.string().nullable(),
});
