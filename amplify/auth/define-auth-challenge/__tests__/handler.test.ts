import type { DefineAuthChallengeTriggerEvent } from 'aws-lambda';
import { handler } from '../handler';

const run = (request: Partial<DefineAuthChallengeTriggerEvent['request']>) =>
  handler(
    { request: { session: [], userAttributes: {}, ...request }, response: {} } as unknown as DefineAuthChallengeTriggerEvent,
    {} as never,
    () => undefined
  ) as Promise<DefineAuthChallengeTriggerEvent>;

const answered = (challengeResult: boolean) => [
  { challengeName: 'CUSTOM_CHALLENGE' as const, challengeResult, challengeMetadata: 'GOOGLE_ID_TOKEN' },
];

describe('define-auth-challenge', () => {
  it('asks for the Google token first', async () => {
    const { response } = await run({});

    expect(response).toMatchObject({ challengeName: 'CUSTOM_CHALLENGE', issueTokens: false, failAuthentication: false });
  });

  it('issues tokens after a correct answer', async () => {
    const { response } = await run({ session: answered(true) });

    expect(response).toMatchObject({ issueTokens: true, failAuthentication: false });
  });

  it('fails after a wrong answer or for an unknown user', async () => {
    expect((await run({ session: answered(false) })).response.failAuthentication).toBe(true);
    expect((await run({ userNotFound: true })).response.failAuthentication).toBe(true);
  });
});
