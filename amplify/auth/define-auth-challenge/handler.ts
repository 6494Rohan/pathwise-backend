import type { DefineAuthChallengeTriggerHandler } from 'aws-lambda';

export const handler: DefineAuthChallengeTriggerHandler = async (event) => {
  const { session, userNotFound } = event.request;
  const lastChallenge = session.at(-1);

  if (userNotFound) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else if (session.length === 0) {
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
  } else if (lastChallenge?.challengeName === 'CUSTOM_CHALLENGE' && lastChallenge.challengeResult) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }
  return event;
};
