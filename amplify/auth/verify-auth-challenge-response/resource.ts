import { defineFunction, secret } from '@aws-amplify/backend';

export const verifyAuthChallengeResponse = defineFunction({
  name: 'verify-auth-challenge-response',
  resourceGroupName: 'auth',
  environment: { GOOGLE_CLIENT_ID: secret('GOOGLE_CLIENT_ID') },
});
