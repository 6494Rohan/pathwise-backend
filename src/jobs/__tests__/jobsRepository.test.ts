import knex from 'knex';
import { JobFiltersSchema, JobListQuery, JobListQuerySchema } from '../jobFilters';
import { buildJobMapPinsQuery, buildListJobsQuery } from '../jobsRepository';

const db = knex({ client: 'pg' });
const filters = (query: Record<string, string> = {}): JobListQuery => JobListQuerySchema.parse(query);
const sqlOf = (query: Record<string, string> = {}) => buildListJobsQuery(db, filters(query)).toSQL().toNative();

afterAll(() => db.destroy());

describe('buildListJobsQuery', () => {
  it('lists open jobs newest first with paging by default', () => {
    const { sql, bindings } = sqlOf();

    expect(sql).toContain('where "j"."status" = $1');
    expect(sql).toContain('order by "j"."posted_at" desc, "j"."id" asc');
    expect(sql).toContain('NULL::float AS distance_km');
    expect(sql).toMatch(/limit \$2$/);
    expect(bindings).toEqual(['open', 20]);
  });

  it('filters by verified company and the last 24 hours', () => {
    const { sql, bindings } = sqlOf({ verified: 'true', last24Hours: 'true' });

    expect(sql).toContain('"c"."is_verified" = $2');
    expect(sql).toContain("j.posted_at >= now() - interval '24 hours'");
    expect(bindings).toContain(true);
  });

  it.each([
    ['0-3', [], [3]],
    ['3-7', [3], [7]],
    ['30+', [30], []],
  ])('filters the %s day bucket', (age, newer, older) => {
    const { sql, bindings } = sqlOf({ age });

    expect(sql.includes('j.posted_at <= now() - make_interval')).toBe(newer.length > 0);
    expect(sql.includes('j.posted_at > now() - make_interval')).toBe(older.length > 0);
    expect(bindings).toEqual(expect.arrayContaining([...newer, ...older]));
  });

  it('finds nearby jobs, returns their distance and sorts nearest first', () => {
    const { sql, bindings } = sqlOf({ lat: '13.34', lng: '74.74', radiusKm: '10' });

    expect(sql).toContain('ST_DWithin(j.location, ST_SetSRID(ST_MakePoint(');
    expect(sql).toContain('ST_Distance(j.location, ST_SetSRID(ST_MakePoint(');
    expect(sql).toContain('order by "distance_km" asc, "j"."posted_at" desc');
    expect(bindings).toEqual(expect.arrayContaining([74.74, 13.34, 10000]));
  });

  it('matches titles by substring or typo, escaping LIKE wildcards', () => {
    const { sql, bindings } = sqlOf({ title: '50%_off' });

    expect(sql).toMatch(/"j"."title" ilike \$\d+ or j.title % \$\d+/);
    expect(bindings).toEqual(expect.arrayContaining(['%50\\%\\_off%', '50%_off']));
  });

  it('searches title, company, city and skill names from one box', () => {
    const { sql, bindings } = sqlOf({ q: 'react' });

    expect(sql).toMatch(/"j"."title" ilike \$\d+ or j.title % \$\d+ or "c"."name" ilike \$\d+ or "j"."city" ilike \$\d+ or exists/);
    expect(sql).toMatch(/"s"."name" ilike \$\d+/);
    expect(bindings.filter((value) => value === '%react%')).toHaveLength(4);
  });

  it('filters by any of the skills and by company', () => {
    const company = '3f1c2a5e-8b7d-4c1a-9e2f-1a2b3c4d5e6f';
    const { sql, bindings } = sqlOf({ skills: 'react,python', companies: company });

    expect(sql).toMatch(/exists \(select 1 from "job_skills" as "js" .* "s"."slug" in \(\$\d+, \$\d+\)\)/);
    expect(sql).toMatch(/"j"."company_id" in \(\$\d+\)/);
    expect(bindings).toEqual(expect.arrayContaining(['react', 'python', company]));
  });

  it('filters by city', () => {
    const { sql, bindings } = sqlOf({ city: 'Udupi' });

    expect(sql).toMatch(/"j"."city" = \$\d+/);
    expect(bindings).toContain('Udupi');
  });

  it('keeps jobs whose experience range includes the given years', () => {
    const { sql, bindings } = sqlOf({ experience: '4' });

    expect(sql).toMatch(/"j"."min_experience_years" <= \$\d+ and \("j"."max_experience_years" is null or "j"."max_experience_years" >= \$\d+\)/);
    expect(bindings.filter((value) => value === 4)).toHaveLength(2);
  });

  it.each([
    ['oldest', 'order by "j"."posted_at" asc, "j"."id" asc'],
    ['salary', 'order by j.salary_max_lpa DESC NULLS LAST, "j"."posted_at" desc, "j"."id" asc'],
    ['newest', 'order by "j"."posted_at" desc, "j"."id" asc'],
  ])('sorts by %s', (sort, orderBy) => {
    expect(sqlOf({ sort }).sql).toContain(orderBy);
  });

  it('sorts a nearby search by distance unless asked otherwise', () => {
    const nearby = { lat: '13.34', lng: '74.74' };

    expect(sqlOf(nearby).sql).toContain('order by "distance_km" asc');
    expect(sqlOf({ ...nearby, sort: 'newest' }).sql).toContain('order by "j"."posted_at" desc, "j"."id" asc');
  });

  it('offsets by page', () => {
    const { bindings } = sqlOf({ page: '3', pageSize: '10' });

    expect(bindings.slice(-2)).toEqual([10, 20]);
  });
});

describe('buildJobMapPinsQuery', () => {
  const pinsSqlOf = (query: Record<string, string> = {}) =>
    buildJobMapPinsQuery(db, JobFiltersSchema.parse(query)).toSQL().toNative();

  it('groups open jobs into one pin per company and city, busiest first', () => {
    const { sql, bindings } = pinsSqlOf();

    expect(sql).toContain('ST_Centroid(ST_Collect(j.location::geometry))');
    expect(sql).toContain('count(*)::int AS open_jobs_count');
    expect(sql).toContain('group by "c"."id", "j"."city"');
    expect(sql).toContain('order by "open_jobs_count" desc');
    expect(sql).not.toContain('limit');
    expect(bindings).toEqual(['open']);
  });

  it('applies the same filters as the job list', () => {
    const query = { verified: 'true', age: '3-7', skills: 'react', experience: '2', lat: '13.3', lng: '74.7' };
    const pins = pinsSqlOf(query).sql;
    const list = sqlOf(query).sql;

    for (const clause of ['"c"."is_verified"', 'make_interval', 'ST_DWithin', '"s"."slug" in', '"j"."min_experience_years" <=']) {
      expect(pins).toContain(clause);
      expect(list).toContain(clause);
    }
  });
});
