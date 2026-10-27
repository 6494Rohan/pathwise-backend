import { logger } from '../logger';

describe('logger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('writes one JSON line per entry, with errors serialised', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.error('listJobs failed', { error: new Error('boom'), requestId: 'r1' });

    const entry = JSON.parse(error.mock.calls[0][0] as string);
    expect(entry).toEqual(
      expect.objectContaining({ level: 'error', message: 'listJobs failed', requestId: 'r1', error: expect.objectContaining({ message: 'boom' }) })
    );
  });

  it('logs info to stdout', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    logger.info('started');

    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual(expect.objectContaining({ level: 'info', message: 'started' }));
  });
});
