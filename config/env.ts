import dotenv from 'dotenv';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
const environment = process.env.TEST_ENV ?? 'local';

// Existing process/CI variables take precedence; .env.<environment>
// takes precedence over .env.
dotenv.config({ path: path.resolve(projectRoot, `.env.${environment}`) });
dotenv.config({ path: path.resolve(projectRoot, '.env') });

const baseURL =
  process.env.BASE_URL || 'https://opensource-demo.orangehrmlive.com';

function numberFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const value = raw ? Number(raw) : fallback;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${key}: expected a positive integer`);
  }

  return value;
}

export const env = {
  name: environment,
  baseURL,
  apiBaseURL: process.env.API_BASE_URL || `${baseURL}/api`,
  apiToken: process.env.API_TOKEN ?? '',
  headless: process.env.HEADLESS !== 'false',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: numberFromEnv('DB_PORT', 5432),
    database: process.env.DB_NAME || 'app_test',
    user: process.env.DB_USER || 'app_test',
    password: process.env.DB_PASSWORD ?? '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  },
} as const;