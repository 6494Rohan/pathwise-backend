import knex, { Knex } from 'knex';
import rdsCertificates from './certs/rds-global-bundle.pem';
import { getConfig } from './config';

let db: Knex | null = null;

// Created on first use and reused while the Lambda container stays warm; one request at a time needs a tiny pool.
export const getDb = (): Knex => {
  if (db) return db;
  const config = getConfig();
  db = knex({
    client: 'pg',
    connection: {
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      ssl: { ca: rdsCertificates, rejectUnauthorized: true },
    },
    pool: { min: 0, max: 2, idleTimeoutMillis: 60_000 },
    acquireConnectionTimeout: 5_000,
  });
  return db;
};
