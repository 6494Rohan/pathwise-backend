import { badRequest, failure, json, parseJsonBody, serverError } from '../http';

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

  it('builds errors with a code', () => {
    expect(JSON.parse(failure(429, 'parse_limit', 'Try tomorrow.').body as string)).toEqual({ error: 'parse_limit', message: 'Try tomorrow.' });
  });

  it('parses JSON bodies, including base64-encoded ones, and returns undefined for bad JSON', () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonBody(Buffer.from('{"a":1}').toString('base64'), true)).toEqual({ a: 1 });
    expect(parseJsonBody(undefined)).toEqual({});
    expect(parseJsonBody('{')).toBeUndefined();
  });
});
