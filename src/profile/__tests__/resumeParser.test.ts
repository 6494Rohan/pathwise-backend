import { parseResumePdf, RESUME_MODEL, ResumeModelClient, ResumeParseError, ResumeParserUnavailableError } from '../resumeParser';

const resume = {
  is_resume: true,
  full_name: 'Aarav Menon',
  email: null,
  phone: null,
  current_designation: null,
  current_location: null,
  skills: ['Python'],
  experiences: [],
  educations: [],
};

const clientReturning = (interaction: object) => {
  const create = jest.fn().mockResolvedValue({ usage: { total_input_tokens: 10, total_output_tokens: 5 }, ...interaction });
  return { client: { interactions: { create } } as unknown as ResumeModelClient, create };
};
const completedWith = (output: unknown) => clientReturning({ status: 'completed', output_text: JSON.stringify(output) });

describe('parseResumePdf', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('sends the PDF as a document to Gemini with minimal thinking, no storage and a JSON schema', async () => {
    const { client, create } = completedWith(resume);

    const result = await parseResumePdf(client, Buffer.from('%PDF-1.7'));

    expect(result).toEqual(expect.objectContaining({ full_name: 'Aarav Menon', skills: ['Python'] }));
    const request = create.mock.calls[0][0];
    expect(request.model).toBe(RESUME_MODEL);
    expect(request.store).toBe(false);
    expect(request.generation_config).toEqual(expect.objectContaining({ thinking_level: 'minimal' }));
    expect(request.response_format).toEqual(expect.objectContaining({ mime_type: 'application/json', schema: expect.any(Object) }));
    expect(request.input[0]).toEqual({ type: 'document', mime_type: 'application/pdf', data: Buffer.from('%PDF-1.7').toString('base64') });
  });

  it('rejects documents that are not resumes', async () => {
    const { client } = completedWith({ ...resume, is_resume: false });

    await expect(parseResumePdf(client, Buffer.from('x'))).rejects.toEqual(expect.objectContaining({ code: 'not_a_resume' }));
  });

  it.each([
    ['an unfinished interaction', { status: 'incomplete', output_text: JSON.stringify(resume) }],
    ['output that is not JSON', { status: 'completed', output_text: '{"is_resume": tr' }],
    ['output that misses the schema', { status: 'completed', output_text: JSON.stringify({ is_resume: 'yes' }) }],
    ['no output', { status: 'completed' }],
  ])('treats %s as unreadable', async (_case, interaction) => {
    const { client } = clientReturning(interaction);

    const error = await parseResumePdf(client, Buffer.from('x')).catch((e) => e);
    expect(error).toBeInstanceOf(ResumeParseError);
    expect(error.code).toBe('unreadable');
  });

  it('wraps API errors as unavailable, keeping the cause', async () => {
    const apiError = new Error('429 rate limited');
    const client = { interactions: { create: jest.fn().mockRejectedValue(apiError) } } as unknown as ResumeModelClient;

    const error = await parseResumePdf(client, Buffer.from('x')).catch((e) => e);
    expect(error).toBeInstanceOf(ResumeParserUnavailableError);
    expect(error.cause).toBe(apiError);
  });
});
