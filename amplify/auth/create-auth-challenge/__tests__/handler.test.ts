import type { CreateAuthChallengeTriggerEvent } from 'aws-lambda';
import { handler } from '../handler';

describe('create-auth-challenge', () => {
  it('asks for a Google ID token without exposing anything private', async () => {
    const event = {
      request: { challengeName: 'CUSTOM_CHALLENGE', session: [], userAttributes: {} },
      response: {},
    } as unknown as CreateAuthChallengeTriggerEvent;

    const { response } = (await handler(event, {} as never, () => undefined)) as CreateAuthChallengeTriggerEvent;

    expect(response).toEqual({
      publicChallengeParameters: { type: 'GOOGLE_ID_TOKEN' },
      privateChallengeParameters: {},
      challengeMetadata: 'GOOGLE_ID_TOKEN',
    });
  });
});
