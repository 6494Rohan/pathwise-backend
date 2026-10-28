import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { AuthorizedEvent, userIdOf } from '../lib/auth';
import { getDb } from '../lib/db';
import { failure, json, serverError } from '../lib/http';
import { logger } from '../lib/logger';
import { getParseLimits, getStorageConfig } from './profileConfig';
import * as profileRepository from './profileRepository';
import { ResumeStoreRequestSchema } from './resumeStoreContract';
import { createResumeDownloadUrl } from './resumeStorage';

export const getProfile = async (event: AuthorizedEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    return json(200, await profileRepository.getOrCreateProfile(getDb(), userIdOf(event)));
  } catch (error) {
    logger.error('getProfile failed', { error, requestId: event.requestContext.requestId });
    return serverError();
  }
};

// Presigning is local (no S3 call), so this works inside the VPC without a NAT or endpoint.
export const getResumeDownloadUrl = async (event: AuthorizedEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    const file = await profileRepository.getResumeFile(getDb(), userIdOf(event));
    if (!file) return failure(404, 'no_resume', 'No resume uploaded yet.');
    const url = await createResumeDownloadUrl(getStorageConfig().RESUMES_BUCKET, file.key, file.fileName);
    return json(200, { url, file_name: file.fileName });
  } catch (error) {
    logger.error('getResumeDownloadUrl failed', { error, requestId: event.requestContext.requestId });
    return serverError();
  }
};

// Invoked only by parseResume (no HTTP route); throwing surfaces as FunctionError to the caller.
export const resumeStore = async (payload: unknown) => {
  const request = ResumeStoreRequestSchema.parse(payload);
  switch (request.action) {
    case 'reserveParse':
      return { allowed: await profileRepository.reserveResumeParse(getDb(), request.userId, getParseLimits()) };
    case 'saveParsed':
      return profileRepository.saveParsedResume(getDb(), request.userId, request.resume, request.file);
  }
};
