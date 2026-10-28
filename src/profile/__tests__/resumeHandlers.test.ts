import { NoSuchKey } from '@aws-sdk/client-s3';
import type { AuthorizedEvent } from '../../lib/auth';
import { createResumeUploadUrl, parseResume } from '../resumeHandlers';
import { parseResumePdf, ResumeParseError, ResumeParserUnavailableError } from '../resumeParser';
import { createResumeStoreClient } from '../resumeStoreClient';
import { createResumeUpload, deleteResumePdf, isOwnResumeKey, readResumePdf } from '../resumeStorage';

jest.mock('@google/genai', () => ({ GoogleGenAI: jest.fn() }));
jest.mock('../resumeParser', () => ({ ...jest.requireActual('../resumeParser'), parseResumePdf: jest.fn() }));
jest.mock('../resumeStoreClient');
jest.mock('../resumeStorage', () => ({ ...jest.requireActual('../resumeStorage'), createResumeUpload: jest.fn(), readResumePdf: jest.fn(), deleteResumePdf: jest.fn() }));

const KEY = 'resumes/user-1/0b7f6c1e-2d3a-4f5b-8c9d-0e1f2a3b4c5d.pdf';
const OLD_KEY = 'resumes/user-1/11111111-2d3a-4f5b-8c9d-0e1f2a3b4c5d.pdf';
const event = (body?: unknown) =>
  ({
    body: body === undefined ? undefined : JSON.stringify(body),
    requestContext: { requestId: 'req-1', authorizer: { jwt: { claims: { sub: 'user-1' } } } },
  }) as unknown as AuthorizedEvent;
const bodyOf = (result: unknown) => JSON.parse((result as { body: string }).body);
const statusOf = (result: unknown) => (result as { statusCode: number }).statusCode;

const store = { reserveParse: jest.fn(), saveParsed: jest.fn() };
const pdf = Buffer.from('%PDF-1.7');

beforeEach(() => {
  Object.assign(process.env, { RESUMES_BUCKET: 'bucket', GEMINI_API_KEY: 'key', RESUME_STORE_FUNCTION: 'store' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.mocked(createResumeStoreClient).mockReturnValue(store);
  store.reserveParse.mockResolvedValue(true);
  store.saveParsed.mockResolvedValue({ profile: { profile_code: 'AB12CD34' }, previousResumeKey: OLD_KEY });
  jest.mocked(readResumePdf).mockResolvedValue({ pdf });
  jest.mocked(parseResumePdf).mockResolvedValue({ full_name: 'Aarav' } as never);
  jest.mocked(deleteResumePdf).mockResolvedValue({} as never);
});
afterEach(() => jest.clearAllMocks());

describe('createResumeUploadUrl', () => {
  it("returns a presigned POST for the user's folder", async () => {
    jest.mocked(createResumeUpload).mockResolvedValue({ key: KEY, url: 'https://s3', fields: { a: 'b' }, maxBytes: 5, expiresInSeconds: 300 });

    expect(bodyOf(await createResumeUploadUrl(event()))).toEqual({
      url: 'https://s3',
      fields: { a: 'b' },
      file_key: KEY,
      max_bytes: 5,
      expires_in_seconds: 300,
    });
    expect(createResumeUpload).toHaveBeenCalledWith('bucket', 'user-1');
  });
});

describe('parseResume', () => {
  const valid = { file_key: KEY, file_name: 'C:\\docs\\Aarav.pdf' };

  it('parses, saves the profile, deletes the old file and returns the profile', async () => {
    const result = await parseResume(event(valid));

    expect(bodyOf(result)).toEqual({ profile_code: 'AB12CD34' });
    expect(store.saveParsed).toHaveBeenCalledWith('user-1', { full_name: 'Aarav' }, { key: KEY, fileName: 'Aarav.pdf', sizeBytes: pdf.length });
    expect(deleteResumePdf).toHaveBeenCalledWith('bucket', OLD_KEY);
  });

  it("rejects another user's file before spending anything", async () => {
    expect(isOwnResumeKey('user-1', KEY.replace('user-1', 'user-2'))).toBe(false);

    expect(statusOf(await parseResume(event({ ...valid, file_key: KEY.replace('user-1', 'user-2') })))).toBe(400);
    expect(store.reserveParse).not.toHaveBeenCalled();
  });

  it('returns 429 without calling the AI once the daily limit is used', async () => {
    store.reserveParse.mockResolvedValue(false);

    expect(bodyOf(await parseResume(event(valid))).error).toBe('parse_limit');
    expect(parseResumePdf).not.toHaveBeenCalled();
  });

  it('rejects files that are too long before calling the AI', async () => {
    jest.mocked(readResumePdf).mockResolvedValue({ problem: 'too_many_pages' });

    const result = await parseResume(event(valid));

    expect(statusOf(result)).toBe(422);
    expect(bodyOf(result).error).toBe('too_many_pages');
    expect(parseResumePdf).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing upload', new NoSuchKey({ message: 'gone', $metadata: {} }), 404, 'upload_missing'],
    ['a non-resume', new ResumeParseError('not_a_resume'), 422, 'not_a_resume'],
    ['an AI outage', new ResumeParserUnavailableError({ cause: new Error('overloaded') }), 503, 'parser_unavailable'],
    ['anything else', new Error('boom'), 500, 'internal_error'],
  ])('maps %s to %i', async (_case, error, status, code) => {
    jest.mocked(parseResumePdf).mockRejectedValue(error);

    const result = await parseResume(event(valid));

    expect(statusOf(result)).toBe(status);
    expect(bodyOf(result).error).toBe(code);
  });

  it('rejects an invalid body', async () => {
    expect(statusOf(await parseResume(event({ file_key: KEY })))).toBe(400);
  });
});
