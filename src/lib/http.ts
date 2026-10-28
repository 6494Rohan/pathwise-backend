import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

const headers = { 'content-type': 'application/json' };

export const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

export const failure = (statusCode: number, error: string, message: string) => json(statusCode, { error, message });

export const badRequest = (message: string, issues?: unknown) => json(400, { error: 'bad_request', message, issues });

export const serverError = () => failure(500, 'internal_error', 'Something went wrong.');

export const parseJsonBody = (body: string | undefined, isBase64Encoded = false): unknown => {
  if (!body) return {};
  try {
    return JSON.parse(isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body);
  } catch {
    return undefined;
  }
};
