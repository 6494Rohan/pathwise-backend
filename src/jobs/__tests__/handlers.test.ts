import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { listJobFilterOptions, listJobMapPins, listJobs } from '../handlers';
import * as jobsRepository from '../jobsRepository';

jest.mock('../../lib/db', () => ({ getDb: jest.fn(() => 'db') }));
jest.mock('../jobsRepository');

const event = (queryStringParameters?: Record<string, string>) =>
  ({ queryStringParameters, requestContext: { requestId: 'req-1' } }) as unknown as APIGatewayProxyEventV2;
const bodyOf = (result: unknown) => JSON.parse((result as { body: string }).body);

describe('listJobs', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('returns a page of jobs for valid filters', async () => {
    jest.mocked(jobsRepository.listJobs).mockResolvedValue({ jobs: [{ job_id: 'j1' } as never], total: 41 });

    const result = await listJobs(event({ verified: 'true', page: '2' }));

    expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
    expect(bodyOf(result)).toEqual({ jobs: [{ job_id: 'j1' }], page: 2, page_size: 20, total: 41 });
    expect(jobsRepository.listJobs).toHaveBeenCalledWith('db', expect.objectContaining({ verified: true, page: 2 }));
  });

  it('rejects invalid filters without touching the database', async () => {
    jest.mocked(jobsRepository.listJobs).mockClear();

    const result = await listJobs(event({ pageSize: '500' }));

    expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
    expect(bodyOf(result).error).toBe('bad_request');
    expect(jobsRepository.listJobs).not.toHaveBeenCalled();
  });

  it('hides database errors behind a 500', async () => {
    jest.mocked(jobsRepository.listJobs).mockRejectedValue(new Error('connection refused at 10.0.0.1'));

    const result = await listJobs(event());

    expect(result).toEqual(expect.objectContaining({ statusCode: 500 }));
    expect(JSON.stringify(bodyOf(result))).not.toContain('10.0.0.1');
  });
});

describe('listJobFilterOptions', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns cities, titles, skills and companies', async () => {
    const options = { cities: [], titles: [], skills: [], companies: [] };
    jest.mocked(jobsRepository.listJobFilterOptions).mockResolvedValue(options);

    expect(bodyOf(await listJobFilterOptions(event()))).toEqual(options);
  });

  it('hides database errors behind a 500', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(jobsRepository.listJobFilterOptions).mockRejectedValue(new Error('boom'));

    expect(await listJobFilterOptions(event())).toEqual(expect.objectContaining({ statusCode: 500 }));
  });
});

describe('listJobMapPins', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns pins for valid filters', async () => {
    const pin = { company_id: 'c1', company_name: 'Axis Bank', is_verified: true, city: 'Udupi', lat: 13.3, lng: 74.7, open_jobs_count: 2 };
    jest.mocked(jobsRepository.listJobMapPins).mockResolvedValue([pin]);

    const result = await listJobMapPins(event({ verified: 'true' }));

    expect(bodyOf(result)).toEqual({ pins: [pin] });
    expect(jobsRepository.listJobMapPins).toHaveBeenCalledWith('db', expect.objectContaining({ verified: true }));
  });

  it('rejects invalid filters and hides database errors', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await listJobMapPins(event({ page: '2' }))).toEqual(expect.objectContaining({ statusCode: 400 }));

    jest.mocked(jobsRepository.listJobMapPins).mockRejectedValue(new Error('boom'));
    expect(await listJobMapPins(event())).toEqual(expect.objectContaining({ statusCode: 500 }));
  });
});
