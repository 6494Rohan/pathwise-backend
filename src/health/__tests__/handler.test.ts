import { health } from '../handler';

describe('health', () => {
  it('reports ok', async () => {
    expect(await health()).toEqual(expect.objectContaining({ statusCode: 200, body: '{"status":"ok"}' }));
  });
});
