describe('getConfig', () => {
  const load = () => {
    let getConfig!: typeof import('../config').getConfig;
    jest.isolateModules(() => {
      ({ getConfig } = require('../config'));
    });
    return getConfig;
  };

  it('reads the database settings and defaults the port', () => {
    const config = load()({ DB_HOST: 'h', DB_NAME: 'n', DB_USER: 'u', DB_PASSWORD: 'p' });

    expect(config).toEqual({ DB_HOST: 'h', DB_NAME: 'n', DB_USER: 'u', DB_PASSWORD: 'p', DB_PORT: 5432 });
  });

  it('names missing settings without printing any values', () => {
    expect(() => load()({ DB_HOST: 'h', DB_PASSWORD: 'super-secret' })).toThrow('Invalid configuration: DB_NAME, DB_USER');
    expect(() => load()({ DB_PASSWORD: 'super-secret' })).not.toThrow(/super-secret/);
  });
});
