import { json } from '../lib/http';

export const health = async () => json(200, { status: 'ok' });
