import { defineAuth } from '@aws-amplify/backend';
import { createAuthChallenge } from './create-auth-challenge/resource';
import { defineAuthChallenge } from './define-auth-challenge/resource';
import { preSignUp } from './pre-sign-up/resource';
import { verifyAuthChallengeResponse } from './verify-auth-challenge-response/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  triggers: {
    preSignUp,
    defineAuthChallenge,
    createAuthChallenge,
    verifyAuthChallengeResponse,
  },
});
