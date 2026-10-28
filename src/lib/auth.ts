import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export type AuthorizedEvent = APIGatewayProxyEventV2WithJWTAuthorizer;

// The API Gateway JWT authorizer has already verified the Cognito access token; `sub` is the stable user id.
export const userIdOf = (event: AuthorizedEvent): string => {
  const sub = event.requestContext.authorizer.jwt.claims.sub;
  if (typeof sub !== 'string' || sub.length === 0) throw new Error('Authorized request without a sub claim');
  return sub;
};
