/**
 * Drizzle Kit Configuration
 * Drizzle Kit 配置
 *
 * This configuration is used by Drizzle Kit for:
 * - Generating SQL migrations from schema
 * - Pushing schema changes to database
 * - Introspecting database schema
 */

import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lucrum',
  },
  verbose: true,
  strict: true,
} satisfies Config;
