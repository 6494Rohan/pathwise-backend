import { GoogleGenAI } from '@google/genai';
import { NoSuchKey } from '@aws-sdk/client-s3';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { AuthorizedEvent, userIdOf } from '../lib/auth';
import { badRequest, failure, json, parseJsonBody, serverError } from '../lib/http';
import { logger } from '../lib/logger';
import { getParserConfig, getStorageConfig } from './profileConfig';
import { parseResumePdf, ResumeModelClient, ResumeParseError, ResumeParserUnavailableError } from './resumeParser';
import { createResumeStoreClient } from './resumeStoreClient';
import { createResumeUpload, deleteResumePdf, isOwnResumeKey, MAX_RESUME_PAGES, readResumePdf, ResumePdfProblem } from './resumeStorage';

// API Gateway's HTTP API cuts requests at 30 s; leave the Lambda (29 s) time to answer.
const AI_TIMEOUT_MS = 25_000;

const ParseResumeBodySchema = z.object({
  file_key: z.string().min(1).max(300),
  file_name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .transform((name) => name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, '')),
});

const PDF_PROBLEMS: Record<ResumePdfProblem, string> = {
  not_pdf: 'The file is not a PDF.',
  too_large: 'The file is larger than 5 MB.',
  too_many_pages: `A resume can have at most ${MAX_RESUME_PAGES} pages.`,
  encrypted: 'This PDF is password-protected. Save or print it as a new PDF and upload that.',
};

let gemini: ResumeModelClient | null = null;
const geminiClient = (apiKey: string) => (gemini ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: AI_TIMEOUT_MS } }));

export const createResumeUploadUrl = async (event: AuthorizedEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    const upload = await createResumeUpload(getStorageConfig().RESUMES_BUCKET, userIdOf(event));
    return json(200, {
      url: upload.url,
      fields: upload.fields,
      file_key: upload.key,
      max_bytes: upload.maxBytes,
      expires_in_seconds: upload.expiresInSeconds,
    });
  } catch (error) {
    logger.error('createResumeUploadUrl failed', { error, requestId: event.requestContext.requestId });
    return serverError();
  }
};

export const parseResume = async (event: AuthorizedEvent): Promise<APIGatewayProxyResultV2> => {
  const parsed = ParseResumeBodySchema.safeParse(parseJsonBody(event.body, event.isBase64Encoded));
  if (!parsed.success) return badRequest('Invalid request', parsed.error.issues);
  const userId = userIdOf(event);
  const { file_key: key, file_name: fileName } = parsed.data;
  if (!isOwnResumeKey(userId, key)) return badRequest('Unknown file');

  let saved = false;
  const config = getParserConfig();
  try {
    const store = createResumeStoreClient(config.RESUME_STORE_FUNCTION);
    if (!(await store.reserveParse(userId))) return failure(429, 'parse_limit', 'Daily resume limit reached. Try again tomorrow.');

    const file = await readResumePdf(config.RESUMES_BUCKET, key);
    if ('problem' in file) return failure(422, file.problem, PDF_PROBLEMS[file.problem]);
    const { pdf } = file;

    const resume = await parseResumePdf(geminiClient(config.GEMINI_API_KEY), pdf);
    const { profile, previousResumeKey } = await store.saveParsed(userId, resume, { key, fileName, sizeBytes: pdf.length });
    saved = true;

    if (previousResumeKey && previousResumeKey !== key) {
      await deleteResumePdf(config.RESUMES_BUCKET, previousResumeKey).catch((error) =>
        logger.warn('old resume not deleted', { error, requestId: event.requestContext.requestId })
      );
    }
    return json(200, profile);
  } catch (error) {
    if (error instanceof NoSuchKey) return failure(404, 'upload_missing', 'Upload the resume before parsing it.');
    if (error instanceof ResumeParseError) {
      return failure(
        422,
        error.code,
        error.code === 'not_a_resume' ? "This file doesn't look like a resume." : "We couldn't read this resume."
      );
    }
    if (error instanceof ResumeParserUnavailableError) {
      logger.error('resume AI call failed', { error: error.cause, requestId: event.requestContext.requestId });
      return failure(503, 'parser_unavailable', 'Resume reading is busy. Try again in a minute.');
    }
    logger.error('parseResume failed', { error, requestId: event.requestContext.requestId });
    return serverError();
  } finally {
    if (!saved) {
      await deleteResumePdf(config.RESUMES_BUCKET, key).catch((error) =>
        logger.warn('failed upload not deleted', { error, requestId: event.requestContext.requestId })
      );
    }
  }
};
