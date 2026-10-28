import { AuthorizedEvent, userIdOf } from '../auth';

const eventWith = (claims: Record<string, unknown>) =>
  ({ requestContext: { authorizer: { jwt: { claims } } } }) as unknown as AuthorizedEvent;

describe('userIdOf', () => {
  it('reads the sub claim', () => {
    expect(userIdOf(eventWith({ sub: 'user-1' }))).toBe('user-1');
  });

  it('refuses a request without one', () => {
    expect(() => userIdOf(eventWith({}))).toThrow('sub claim');
  });
});
