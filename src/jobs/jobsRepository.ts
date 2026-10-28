import type { Knex } from 'knex';
import type { AgeBucket, JobFilters, JobListQuery } from './jobFilters';
import type {
  CityOption,
  CompanyOption,
  JobFilterOptions,
  JobListItem,
  JobMapPin,
  JobPage,
  SkillOption,
  TitleOption,
} from './jobs.types';

// [newer, older] bound in days since posting; null = open-ended.
const AGE_RANGES: Record<AgeBucket, [number | null, number | null]> = {
  '0-3': [null, 3],
  '3-7': [3, 7],
  '7-15': [7, 15],
  '15-30': [15, 30],
  '30+': [30, null],
};

type JobRow = JobListItem & { total_count: string };

// The app searches within these, so the most common values are enough.
const MAX_FILTER_OPTIONS = 200;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const pointOf = (db: Knex, filters: JobFilters) =>
  filters.lat !== undefined && filters.lng !== undefined
    ? db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [filters.lng, filters.lat])
    : null;

const byVerifiedCompany = (query: Knex.QueryBuilder, filters: JobFilters) => {
  if (filters.verified) query.where('c.is_verified', true);
};

const byPostedAge = (query: Knex.QueryBuilder, filters: JobFilters) => {
  if (filters.last24Hours) query.whereRaw("j.posted_at >= now() - interval '24 hours'");
  if (filters.lastWeek) query.whereRaw("j.posted_at >= now() - interval '7 days'");
  if (!filters.age) return;
  const [newer, older] = AGE_RANGES[filters.age];
  if (newer !== null) query.whereRaw('j.posted_at <= now() - make_interval(days => ?)', [newer]);
  if (older !== null) query.whereRaw('j.posted_at > now() - make_interval(days => ?)', [older]);
};

const byDistance = (query: Knex.QueryBuilder, point: Knex.Raw | null, radiusKm: number) => {
  if (point) query.whereRaw('ST_DWithin(j.location, ?, ?)', [point, radiusKm * 1000]);
};

// ILIKE catches substrings ("dev"), pg_trgm similarity catches typos ("develper").
const byTitle = (query: Knex.QueryBuilder, filters: JobFilters) => {
  const { title } = filters;
  if (!title) return;
  query.where((match) => match.whereILike('j.title', `%${escapeLike(title)}%`).orWhereRaw('j.title % ?', [title]));
};

// The app's single search box: title (substring or typo), company, city or skill name.
const bySearch = (db: Knex) => (query: Knex.QueryBuilder, filters: JobFilters) => {
  const { q } = filters;
  if (!q) return;
  const pattern = `%${escapeLike(q)}%`;
  query.where((match) =>
    match
      .whereILike('j.title', pattern)
      .orWhereRaw('j.title % ?', [q])
      .orWhereILike('c.name', pattern)
      .orWhereILike('j.city', pattern)
      .orWhereExists(
        db('job_skills as js')
          .select(db.raw('1'))
          .join('skills as s', 's.id', 'js.skill_id')
          .whereRaw('js.job_id = j.id')
          .whereILike('s.name', pattern)
      )
  );
};

const bySkills = (db: Knex) => (query: Knex.QueryBuilder, filters: JobFilters) => {
  if (!filters.skills) return;
  query.whereExists(
    db('job_skills as js')
      .select(db.raw('1'))
      .join('skills as s', 's.id', 'js.skill_id')
      .whereRaw('js.job_id = j.id')
      .whereIn('s.slug', filters.skills)
  );
};

const byCompanies = (query: Knex.QueryBuilder, filters: JobFilters) => {
  if (filters.companies) query.whereIn('j.company_id', filters.companies);
};

const byCity = (query: Knex.QueryBuilder, filters: JobFilters) => {
  if (filters.city) query.where('j.city', filters.city);
};

const byCities = (query: Knex.QueryBuilder, filters: JobFilters) => {
  if (filters.cities) query.whereIn('j.city', filters.cities);
};

const byTitles = (query: Knex.QueryBuilder, filters: JobFilters) => {
  if (filters.titles) query.whereIn('j.title', filters.titles);
};

const byExperience = (query: Knex.QueryBuilder, filters: JobFilters) => {
  const years = filters.experience;
  if (years === undefined) return;
  query
    .where('j.min_experience_years', '<=', years)
    .andWhere((max) => max.whereNull('j.max_experience_years').orWhere('j.max_experience_years', '>=', years));
};

// Open jobs matching every filter; the list and the map both start from this.
const filteredJobs = (db: Knex, filters: JobFilters, point: Knex.Raw | null) =>
  db('jobs as j')
    .join('companies as c', 'c.id', 'j.company_id')
    .where('j.status', 'open')
    .modify(byVerifiedCompany, filters)
    .modify(byPostedAge, filters)
    .modify(byDistance, point, filters.radiusKm)
    .modify(bySearch(db), filters)
    .modify(byTitle, filters)
    .modify(bySkills(db), filters)
    .modify(byCompanies, filters)
    .modify(byCity, filters)
    .modify(byCities, filters)
    .modify(byTitles, filters)
    .modify(byExperience, filters);

export const buildListJobsQuery = (db: Knex, filters: JobListQuery) => {
  const point = pointOf(db, filters);
  const skillsOfJob = db('job_skills as js')
    .select(
      db.raw(
        "COALESCE(json_agg(json_build_object('skill_id', s.id, 'skill_name', s.name, 'slug', s.slug) ORDER BY s.name), '[]'::json)"
      )
    )
    .join('skills as s', 's.id', 'js.skill_id')
    .whereRaw('js.job_id = j.id');

  const query = filteredJobs(db, filters, point)
    .select(
      'j.id as job_id',
      'j.title as job_title',
      'j.employment_type as job_type',
      'j.work_mode',
      'j.city',
      db.raw('ST_Y(j.location::geometry) AS lat'),
      db.raw('ST_X(j.location::geometry) AS lng'),
      'j.min_experience_years',
      'j.max_experience_years',
      db.raw('j.salary_min_lpa::float AS min_ctc_lpa'),
      db.raw('j.salary_max_lpa::float AS max_ctc_lpa'),
      'j.posted_at',
      point
        ? db.raw('round((ST_Distance(j.location, ?) / 1000)::numeric, 1)::float AS distance_km', [point])
        : db.raw('NULL::float AS distance_km'),
      db.raw(
        "json_build_object('company_id', c.id, 'company_name', c.name, 'logo_url', c.logo_url, 'is_verified', c.is_verified) AS company"
      ),
      skillsOfJob.as('skills'),
      db.raw('count(*) OVER () AS total_count')
    )
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  // Nearby searches default to nearest first; everything ends on id so pages never overlap.
  switch (filters.sort ?? (point ? 'nearest' : 'newest')) {
    case 'nearest':
      query.orderBy('distance_km', 'asc').orderBy('j.posted_at', 'desc');
      break;
    case 'oldest':
      query.orderBy('j.posted_at', 'asc');
      break;
    case 'salary':
      query.orderByRaw('j.salary_max_lpa DESC NULLS LAST').orderBy('j.posted_at', 'desc');
      break;
    case 'newest':
      query.orderBy('j.posted_at', 'desc');
      break;
  }
  return query.orderBy('j.id', 'asc');
};

export const listJobs = async (db: Knex, filters: JobListQuery): Promise<JobPage> => {
  const rows: JobRow[] = await buildListJobsQuery(db, filters);
  return {
    jobs: rows.map(({ total_count: _total, ...job }) => job),
    total: rows.length ? Number(rows[0].total_count) : 0,
  };
};

// One pin per company per city, at the centre of that company's matching jobs there.
export const buildJobMapPinsQuery = (db: Knex, filters: JobFilters) =>
  filteredJobs(db, filters, pointOf(db, filters))
    .select(
      'c.id as company_id',
      'c.name as company_name',
      'c.is_verified',
      'j.city',
      db.raw('ST_Y(ST_Centroid(ST_Collect(j.location::geometry))) AS lat'),
      db.raw('ST_X(ST_Centroid(ST_Collect(j.location::geometry))) AS lng'),
      db.raw('count(*)::int AS open_jobs_count')
    )
    .groupBy('c.id', 'j.city')
    .orderBy([{ column: 'open_jobs_count', order: 'desc' }, 'c.name', 'j.city']);

export const listJobMapPins = async (db: Knex, filters: JobFilters): Promise<JobMapPin[]> =>
  buildJobMapPinsQuery(db, filters);

export const listJobFilterOptions = async (db: Knex): Promise<JobFilterOptions> => {
  const openJobs = () => db('jobs as j').where('j.status', 'open');
  const [cities, titles, skills, companies] = await Promise.all([
    openJobs()
      .select('j.city', db.raw('count(*)::int AS job_count'))
      .groupBy('j.city')
      .orderBy([{ column: 'job_count', order: 'desc' }, 'j.city'])
      .limit(MAX_FILTER_OPTIONS) as Promise<CityOption[]>,
    openJobs()
      .select('j.title as job_title', db.raw('count(*)::int AS job_count'))
      .groupBy('j.title')
      .orderBy([{ column: 'job_count', order: 'desc' }, 'j.title'])
      .limit(MAX_FILTER_OPTIONS) as Promise<TitleOption[]>,
    db('skills as s')
      .select('s.id as skill_id', 's.name as skill_name', 's.slug', db.raw('count(*)::int AS job_count'))
      .join('job_skills as js', 'js.skill_id', 's.id')
      .join('jobs as j', 'j.id', 'js.job_id')
      .where('j.status', 'open')
      .groupBy('s.id')
      .orderBy([{ column: 'job_count', order: 'desc' }, 's.name'])
      .limit(MAX_FILTER_OPTIONS) as Promise<SkillOption[]>,
    db('companies as c')
      .select('c.id as company_id', 'c.name as company_name', 'c.is_verified', db.raw('count(*)::int AS job_count'))
      .join('jobs as j', 'j.company_id', 'c.id')
      .where('j.status', 'open')
      .groupBy('c.id')
      .orderBy([{ column: 'job_count', order: 'desc' }, 'c.name'])
      .limit(MAX_FILTER_OPTIONS) as Promise<CompanyOption[]>,
  ]);
  return { cities, titles, skills, companies };
};
