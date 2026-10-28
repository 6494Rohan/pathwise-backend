import { z } from 'zod';

export const AGE_BUCKETS = ['0-3', '3-7', '7-15', '15-30', '30+'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];
export const MAX_PAGE_SIZE = 50;
export const JOB_SORTS = ['newest', 'oldest', 'salary', 'nearest'] as const;
export type JobSort = (typeof JOB_SORTS)[number];

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');
const commaList = (item: z.ZodTypeAny, max: number) =>
  z
    .string()
    .transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean))
    .pipe(z.array(item).min(1).max(max));

const filterFields = {
  verified: booleanFlag.optional(),
  last24Hours: booleanFlag.optional(),
  lastWeek: booleanFlag.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(200).default(25),
  age: z.enum(AGE_BUCKETS).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  title: z.string().trim().min(2).max(100).optional(),
  skills: commaList(z.string().regex(/^[a-z0-9-]+$/), 10).optional(),
  companies: commaList(z.string().uuid(), 20).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  cities: commaList(z.string().min(1).max(100), 20).optional(),
  titles: commaList(z.string().min(1).max(200), 20).optional(),
  experience: z.coerce.number().int().min(0).max(50).optional(),
};

const latAndLngTogether = <T extends { lat?: number; lng?: number }>(filters: T) =>
  (filters.lat === undefined) === (filters.lng === undefined);
const latAndLngMessage = { message: 'lat and lng must be given together', path: ['lat'] };

// Shared by GET /jobs and GET /jobs/map so the list and the map always show the same jobs.
export const JobFiltersSchema = z.object(filterFields).strict().refine(latAndLngTogether, latAndLngMessage);

export const JobListQuerySchema = z
  .object({
    ...filterFields,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    sort: z.enum(JOB_SORTS).optional(),
  })
  .strict()
  .refine(latAndLngTogether, latAndLngMessage)
  .refine((query) => query.sort !== 'nearest' || query.lat !== undefined, {
    message: 'sort=nearest needs lat and lng',
    path: ['sort'],
  });

export type JobFilters = z.infer<typeof JobFiltersSchema>;
export type JobListQuery = z.infer<typeof JobListQuerySchema>;
