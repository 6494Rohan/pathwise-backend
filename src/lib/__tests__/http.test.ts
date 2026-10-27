import { badRequest, json, serverError } from '../http';

describe('http responses', () => {
  it('serialises JSON with a content type', () => {
    expect(json(201, { ok: true })).toEqual({
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
  });

  it('builds client and server errors', () => {
    expect(JSON.parse(badRequest('Invalid filters', [{ path: ['age'] }]).body as string)).toEqual({
      error: 'bad_request',
      message: 'Invalid filters',
      issues: [{ path: ['age'] }],
    });
    expect(serverError()).toEqual(expect.objectContaining({ statusCode: 500 }));
  });
});
