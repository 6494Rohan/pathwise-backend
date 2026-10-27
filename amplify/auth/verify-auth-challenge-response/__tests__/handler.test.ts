import type { VerifyAuthChallengeResponseTriggerEvent } from 'aws-lambda';
import { isGoogleTokenFor } from '../../google/verifyGoogleIdToken';
import { handler } from '../handler';

jest.mock('../../google/verifyGoogleIdToken', () => ({ isGoogleTokenFor: jest.fn() }));

const run = () =>
  handler(
    {
      request: { challengeAnswer: 'token', userAttributes: { email: 'rohan@example.com' }, privateChallengeParameters: {} },
      response: {},
    } as unknown as VerifyAuthChallengeResponseTriggerEvent,
    {} as never,
    () => undefined
  ) as Promise<VerifyAuthChallengeResponseTriggerEvent>;

describe('verify-auth-challenge-response', () => {
  it('accepts a Google token for the same email', async () => {
    jest.mocked(isGoogleTokenFor).mockResolvedValueOnce(true);

    expect((await run()).response.answerCorrect).toBe(true);
    expect(isGoogleTokenFor).toHaveBeenCalledWith('token', 'rohan@example.com');
  });

  it('rejects anything else', async () => {
    jest.mocked(isGoogleTokenFor).mockResolvedValueOnce(false);

    expect((await run()).response.answerCorrect).toBe(false);
  });
});
