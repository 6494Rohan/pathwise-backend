import { defineFunction, secret } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
  name: 'pre-sign-up',
  resourceGroupName: 'auth',
  environment: { GOOGLE_CLIENT_ID: secret('GOOGLE_CLIENT_ID') },
});
