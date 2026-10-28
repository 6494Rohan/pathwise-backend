import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { ProfileDto, ResumeFile } from './profile.types';
import type { ResumeDetails } from './resumeSchema';
import { ReserveParseResultSchema, ResumeStoreRequest, SaveParsedResultSchema } from './resumeStoreContract';

const lambda = new LambdaClient({});

const invoke = async (functionName: string, request: ResumeStoreRequest): Promise<unknown> => {
  const result = await lambda.send(new InvokeCommand({ FunctionName: functionName, Payload: JSON.stringify(request) }));
  if (result.FunctionError || !result.Payload) throw new Error(`resumeStore ${request.action} failed: ${result.FunctionError ?? 'empty payload'}`);
  return JSON.parse(Buffer.from(result.Payload).toString('utf8'));
};

export const createResumeStoreClient = (functionName: string) => ({
  reserveParse: async (userId: string) =>
    ReserveParseResultSchema.parse(await invoke(functionName, { action: 'reserveParse', userId })).allowed,
  saveParsed: async (userId: string, resume: ResumeDetails, file: ResumeFile) => {
    const result = SaveParsedResultSchema.parse(await invoke(functionName, { action: 'saveParsed', userId, resume, file }));
    return { profile: result.profile as unknown as ProfileDto, previousResumeKey: result.previousResumeKey };
  },
});

export type ResumeStoreClient = ReturnType<typeof createResumeStoreClient>;
