import { z } from 'zod';

const ConfigSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config | null = null;

export const getConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  if (config) return config;
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  config = parsed.data;
  return config;
};
