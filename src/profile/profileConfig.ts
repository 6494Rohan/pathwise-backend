import { z } from 'zod';
import { parseEnv } from '../lib/config';

const StorageConfigSchema = z.object({ RESUMES_BUCKET: z.string().min(1) });

const ParserConfigSchema = StorageConfigSchema.extend({
  GEMINI_API_KEY: z.string().min(1),
  RESUME_STORE_FUNCTION: z.string().min(1),
});

// Cost caps: each user, and the whole app, get a fixed number of AI parses per UTC day.
const ParseLimitsSchema = z.object({
  RESUME_PARSES_PER_USER: z.coerce.number().int().positive().default(3),
  RESUME_PARSES_TOTAL: z.coerce.number().int().positive().default(100),
});

export const getStorageConfig = (env: NodeJS.ProcessEnv = process.env) => parseEnv(StorageConfigSchema, env);

export const getParserConfig = (env: NodeJS.ProcessEnv = process.env) => parseEnv(ParserConfigSchema, env);

export const getParseLimits = (env: NodeJS.ProcessEnv = process.env) => {
  const limits = parseEnv(ParseLimitsSchema, env);
  return { perUser: limits.RESUME_PARSES_PER_USER, total: limits.RESUME_PARSES_TOTAL };
};
