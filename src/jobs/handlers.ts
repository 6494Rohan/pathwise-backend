import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getDb } from '../lib/db';
import { badRequest, json, serverError } from '../lib/http';
import { logger } from '../lib/logger';
import { JobFiltersSchema, JobListQuerySchema } from './jobFilters';
import * as jobsRepository from './jobsRepository';

export const listJobs = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const parsed = JobListQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) return badRequest('Invalid filters', parsed.error.issues);

  try {
    const { jobs, total } = await jobsRepository.listJobs(getDb(), parsed.data);
    return json(200, { jobs, page: parsed.data.page, page_size: parsed.data.pageSize, total });
  } catch (error) {
    logger.error('listJobs failed', { error, requestId: event.requestContext?.requestId });
    return serverError();
  }
};

export const listJobMapPins = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const parsed = JobFiltersSchema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) return badRequest('Invalid filters', parsed.error.issues);

  try {
    return json(200, { pins: await jobsRepository.listJobMapPins(getDb(), parsed.data) });
  } catch (error) {
    logger.error('listJobMapPins failed', { error, requestId: event.requestContext?.requestId });
    return serverError();
  }
};

export const listJobFilterOptions = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    return json(200, await jobsRepository.listJobFilterOptions(getDb()));
  } catch (error) {
    logger.error('listJobFilterOptions failed', { error, requestId: event.requestContext?.requestId });
    return serverError();
  }
};
