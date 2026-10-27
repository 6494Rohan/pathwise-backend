import { jwtVerify } from 'jose';
import { googleClientId, isGoogleTokenFor, verifyGoogleIdToken } from '../verifyGoogleIdToken';

jest.mock('jose', () => ({ createRemoteJWKSet: jest.fn(() => 'google-keys'), jwtVerify: jest.fn() }));

const verified = (payload: Record<string, unknown>) =>
  jest.mocked(jwtVerify).mockResolvedValueOnce({ payload, protectedHeader: { alg: 'RS256' } } as never);

describe('verifyGoogleIdToken', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'web-client';
  });

  it('checks the signature, issuer and audience and returns the verified email', async () => {
    verified({ email: 'Rohan@Example.com', email_verified: true });

    await expect(verifyGoogleIdToken('token', 'web-client')).resolves.toBe('rohan@example.com');
    expect(jwtVerify).toHaveBeenCalledWith('token', 'google-keys', {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: 'web-client',
    });
  });

  it('rejects unverified emails and invalid tokens', async () => {
    verified({ email: 'rohan@example.com', email_verified: false });
    await expect(verifyGoogleIdToken('token', 'web-client')).resolves.toBeNull();

    jest.mocked(jwtVerify).mockRejectedValueOnce(new Error('signature verification failed'));
    await expect(verifyGoogleIdToken('token', 'web-client')).resolves.toBeNull();
  });

  it('matches the token only to the same email', async () => {
    verified({ email: 'rohan@example.com', email_verified: true });
    await expect(isGoogleTokenFor('token', 'ROHAN@example.com')).resolves.toBe(true);

    verified({ email: 'someone@example.com', email_verified: true });
    await expect(isGoogleTokenFor('token', 'rohan@example.com')).resolves.toBe(false);

    await expect(isGoogleTokenFor('token', undefined)).resolves.toBe(false);
  });

  it('fails loudly without the client ID', () => {
    delete process.env.GOOGLE_CLIENT_ID;

    expect(() => googleClientId()).toThrow('GOOGLE_CLIENT_ID is not set');
  });
});
