import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

const headers = { 'content-type': 'application/json' };

export const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

export const badRequest = (message: string, issues?: unknown) => json(400, { error: 'bad_request', message, issues });

export const serverError = () => json(500, { error: 'internal_error', message: 'Something went wrong.' });
