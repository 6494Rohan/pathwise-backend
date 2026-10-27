import { JobFiltersSchema, JobListQuerySchema } from '../jobFilters';

const parse = (query: Record<string, string>) => JobListQuerySchema.safeParse(query);

describe('JobListQuerySchema', () => {
  it('applies paging and radius defaults', () => {
    expect(parse({})).toEqual({ success: true, data: { page: 1, pageSize: 20, radiusKm: 25 } });
  });

  it('parses every filter from query-string values', () => {
    const result = parse({
      verified: 'true',
      last24Hours: 'false',
      lat: '13.34',
      lng: '74.74',
      radiusKm: '10',
      age: '3-7',
      title: ' developer ',
      skills: 'react, node-js',
      companies: '3f1c2a5e-8b7d-4c1a-9e2f-1a2b3c4d5e6f',
      experience: '3',
      page: '2',
      pageSize: '50',
    });

    expect(result).toEqual({
      success: true,
      data: {
        verified: true,
        last24Hours: false,
        lat: 13.34,
        lng: 74.74,
        radiusKm: 10,
        age: '3-7',
        title: 'developer',
        skills: ['react', 'node-js'],
        companies: ['3f1c2a5e-8b7d-4c1a-9e2f-1a2b3c4d5e6f'],
        experience: 3,
        page: 2,
        pageSize: 50,
      },
    });
  });

  it.each([
    [{ lat: '13.3' }, 'lat without lng'],
    [{ pageSize: '51' }, 'page size above the cap'],
    [{ age: '1-2' }, 'unknown age bucket'],
    [{ skills: 'React JS' }, 'skill that is not a slug'],
    [{ companies: 'not-a-uuid' }, 'company that is not a UUID'],
    [{ verified: 'yes' }, 'non-boolean flag'],
    [{ sort: 'price' }, 'unknown sort'],
    [{ sort: 'nearest' }, 'nearest without a location'],
    [{ order: 'asc' }, 'unknown parameter'],
    [{ title: 'a' }, 'one-letter title'],
  ] as [Record<string, string>, string][])('rejects %j (%s)', (query) => {
    expect(parse(query).success).toBe(false);
  });
});

describe('JobFiltersSchema (map)', () => {
  it('takes the same filters without paging', () => {
    expect(JobFiltersSchema.parse({ verified: 'true', skills: 'react' })).toEqual({ verified: true, skills: ['react'], radiusKm: 25 });
  });

  it('rejects paging parameters and lone coordinates', () => {
    expect(JobFiltersSchema.safeParse({ page: '2' }).success).toBe(false);
    expect(JobFiltersSchema.safeParse({ lng: '74.7' }).success).toBe(false);
  });
});
