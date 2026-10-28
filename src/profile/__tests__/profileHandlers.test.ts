import type { AuthorizedEvent } from '../../lib/auth';
import { getProfile, getResumeDownloadUrl, resumeStore } from '../profileHandlers';
import * as profileRepository from '../profileRepository';
import { createResumeDownloadUrl } from '../resumeStorage';

jest.mock('../../lib/db', () => ({ getDb: jest.fn(() => 'db') }));
jest.mock('../profileRepository');
jest.mock('../resumeStorage');

const event = { requestContext: { requestId: 'req-1', authorizer: { jwt: { claims: { sub: 'user-1' } } } } } as unknown as AuthorizedEvent;
const bodyOf = (result: unknown) => JSON.parse((result as { body: string }).body);

beforeEach(() => {
  process.env.RESUMES_BUCKET = 'bucket';
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('getProfile', () => {
  it("returns the signed-in user's profile", async () => {
    jest.mocked(profileRepository.getOrCreateProfile).mockResolvedValue({ profile_code: 'AB12CD34' } as never);

    expect(bodyOf(await getProfile(event))).toEqual({ profile_code: 'AB12CD34' });
    expect(profileRepository.getOrCreateProfile).toHaveBeenCalledWith('db', 'user-1');
  });

  it('hides database errors behind a 500', async () => {
    jest.mocked(profileRepository.getOrCreateProfile).mockRejectedValue(new Error('boom'));

    expect(await getProfile(event)).toEqual(expect.objectContaining({ statusCode: 500 }));
  });
});

describe('getResumeDownloadUrl', () => {
  it('signs a short-lived link to the saved resume', async () => {
    jest.mocked(profileRepository.getResumeFile).mockResolvedValue({ key: 'resumes/user-1/a.pdf', fileName: 'Aarav.pdf' });
    jest.mocked(createResumeDownloadUrl).mockResolvedValue('https://signed');

    expect(bodyOf(await getResumeDownloadUrl(event))).toEqual({ url: 'https://signed', file_name: 'Aarav.pdf' });
    expect(createResumeDownloadUrl).toHaveBeenCalledWith('bucket', 'resumes/user-1/a.pdf', 'Aarav.pdf');
  });

  it('returns 404 when no resume is saved', async () => {
    jest.mocked(profileRepository.getResumeFile).mockResolvedValue(null);

    expect(await getResumeDownloadUrl(event)).toEqual(expect.objectContaining({ statusCode: 404 }));
  });
});

describe('resumeStore', () => {
  it('reserves a parse within the daily limits', async () => {
    process.env.RESUME_PARSES_PER_USER = '5';
    process.env.RESUME_PARSES_TOTAL = '50';
    jest.mocked(profileRepository.reserveResumeParse).mockResolvedValue(false);

    expect(await resumeStore({ action: 'reserveParse', userId: 'user-1' })).toEqual({ allowed: false });
    expect(profileRepository.reserveResumeParse).toHaveBeenCalledWith('db', 'user-1', { perUser: 5, total: 50 });
    delete process.env.RESUME_PARSES_PER_USER;
    delete process.env.RESUME_PARSES_TOTAL;
  });

  it('saves a parsed resume', async () => {
    const saved = { profile: { profile_code: 'AB12CD34' }, previousResumeKey: null };
    jest.mocked(profileRepository.saveParsedResume).mockResolvedValue(saved as never);
    const resume = { full_name: null, email: null, phone: null, current_designation: null, current_location: null, skills: [], experiences: [], educations: [] };
    const file = { key: 'resumes/user-1/a.pdf', fileName: 'a.pdf', sizeBytes: 10 };

    expect(await resumeStore({ action: 'saveParsed', userId: 'user-1', resume, file })).toBe(saved);
    expect(profileRepository.saveParsedResume).toHaveBeenCalledWith('db', 'user-1', resume, file);
  });

  it('rejects malformed requests', async () => {
    await expect(resumeStore({ action: 'dropTables' })).rejects.toThrow();
  });
});
