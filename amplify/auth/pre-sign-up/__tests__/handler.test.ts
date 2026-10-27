import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { isGoogleTokenFor } from '../../google/verifyGoogleIdToken';
import { handler } from '../handler';

jest.mock('../../google/verifyGoogleIdToken', () => ({ isGoogleTokenFor: jest.fn() }));

const event = (validationData?: Record<string, string>) =>
  ({
    request: { userAttributes: { email: 'rohan@example.com' }, validationData },
    response: { autoConfirmUser: false, autoVerifyEmail: false, autoVerifyPhone: false },
  }) as unknown as PreSignUpTriggerEvent;

const run = (input: PreSignUpTriggerEvent) => handler(input, {} as never, () => undefined) as Promise<PreSignUpTriggerEvent>;

describe('pre-sign-up', () => {
  it('leaves email + password sign-ups to the emailed code', async () => {
    const result = await run(event());

    expect(result.response.autoConfirmUser).toBe(false);
    expect(isGoogleTokenFor).not.toHaveBeenCalled();
  });

  it('confirms Google sign-ups whose token matches the email', async () => {
    jest.mocked(isGoogleTokenFor).mockResolvedValueOnce(true);

    const result = await run(event({ googleIdToken: 'token' }));

    expect(isGoogleTokenFor).toHaveBeenCalledWith('token', 'rohan@example.com');
    expect(result.response).toMatchObject({ autoConfirmUser: true, autoVerifyEmail: true });
  });

  it('rejects a Google sign-up whose token does not match', async () => {
    jest.mocked(isGoogleTokenFor).mockResolvedValueOnce(false);

    await expect(run(event({ googleIdToken: 'token' }))).rejects.toThrow('Google sign-up could not be verified');
  });
});
