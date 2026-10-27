import type { PreSignUpTriggerHandler } from 'aws-lambda';
import { isGoogleTokenFor } from '../google/verifyGoogleIdToken';

// Google already verified the email, so Google sign-ups skip the emailed code. Email + password sign-ups pass through.
export const handler: PreSignUpTriggerHandler = async (event) => {
  const idToken = event.request.validationData?.googleIdToken;
  if (!idToken) return event;

  if (!(await isGoogleTokenFor(idToken, event.request.userAttributes.email))) {
    throw new Error('Google sign-up could not be verified');
  }
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};
