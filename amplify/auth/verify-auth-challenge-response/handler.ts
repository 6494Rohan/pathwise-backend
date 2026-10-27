import type { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';
import { isGoogleTokenFor } from '../google/verifyGoogleIdToken';

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  event.response.answerCorrect = await isGoogleTokenFor(event.request.challengeAnswer, event.request.userAttributes.email);
  return event;
};
