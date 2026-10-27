import type { CreateAuthChallengeTriggerHandler } from 'aws-lambda';

export const GOOGLE_CHALLENGE = 'GOOGLE_ID_TOKEN';

export const handler: CreateAuthChallengeTriggerHandler = async (event) => {
  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    event.response.publicChallengeParameters = { type: GOOGLE_CHALLENGE };
    event.response.privateChallengeParameters = {};
    event.response.challengeMetadata = GOOGLE_CHALLENGE;
  }
  return event;
};
