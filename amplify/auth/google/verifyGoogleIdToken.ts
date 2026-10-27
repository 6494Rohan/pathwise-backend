import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const googleClientId = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
  return clientId;
};

// Resolves to the lower-cased email only for a token signed by Google, issued to our client and with a verified email.
export const verifyGoogleIdToken = async (idToken: string, clientId: string): Promise<string | null> => {
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_KEYS, { issuer: GOOGLE_ISSUERS, audience: clientId });
    if (payload.email_verified !== true || typeof payload.email !== 'string') return null;
    return payload.email.toLowerCase();
  } catch {
    return null;
  }
};

export const isGoogleTokenFor = async (idToken: string, email: string | undefined) =>
  !!email && (await verifyGoogleIdToken(idToken, googleClientId())) === email.toLowerCase();
