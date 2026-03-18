/**
 * Database Connection
 * 数据库连接
 *
 * PostgreSQL database connection using Drizzle ORM
 * 使用Drizzle ORM连接PostgreSQL数据库
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Get database connection URL from environment
 * 从环境变量获取数据库连接URL
 *
 * Required environment variables:
 * - DATABASE_URL: Full PostgreSQL connection string
 *   OR
 * - DATABASE_HOST: PostgreSQL host
 * - DATABASE_PORT: PostgreSQL port (default: 5432)
 * - DATABASE_NAME: Database name
 * - DATABASE_USER: Database user
 * - DATABASE_PASSWORD: Database password
 */
function getDatabaseUrl(): string {
  // Option 1: Use full connection string if provided
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Option 2: Build connection string from individual parts
  const host = process.env.DATABASE_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || '5432';
  const database = process.env.DATABASE_NAME || 'lucrum';
  const user = process.env.DATABASE_USER || 'postgres';
  const password = process.env.DATABASE_PASSWORD || '';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// ============================================================================
// Connection Pool
// ============================================================================

/**
 * PostgreSQL connection pool
 * PostgreSQL连接池
 *
 * Configuration:
 * - max: 20 connections (suitable for production)
 * - idleTimeoutMillis: 30 seconds
 * - connectionTimeoutMillis: 5 seconds
 */
export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout after 5s
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('[Database] Unexpected pool error:', err);
});

// Log connection info (hide password)
const dbUrl = getDatabaseUrl().replace(/:[^:@]+@/, ':****@');
console.log(`[Database] Connecting to: ${dbUrl}`);

// ============================================================================
// Drizzle ORM Instance
// ============================================================================

/**
 * Drizzle ORM database instance
 * Drizzle ORM数据库实例
 *
 * Provides type-safe query builder and schema management
 */
export const db = drizzle(pool, { schema });

// ============================================================================
// Connection Test
// ============================================================================

/**
 * Test database connection
 * 测试数据库连接
 *
 * @returns Promise resolving to true if connection successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    console.log('[Database] Connection successful. Server time:', result.rows[0]?.now);
    return true;
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    return false;
  }
}

/**
 * Close database connection pool
 * 关闭数据库连接池
 *
 * Call this when shutting down the application
 */
export async function closeConnection(): Promise<void> {
  await pool.end();
  console.log('[Database] Connection pool closed');
}

// ============================================================================
// Database Initialization
// ============================================================================

/**
 * Initialize database tables
 * 初始化数据库表
 *
 * This function should be called once during application setup
 * to create all necessary tables if they don't exist.
 *
 * Note: In production, use Drizzle migrations instead.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('[Database] Initializing database schema...');

    // Create tables if they don't exist
    // This is a simplified version - in production, use Drizzle migrations
    const client = await pool.connect();

    try {
      // Check if tables exist
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('stocks', 'sectors', 'stock_sector_mapping', 'kline_daily', 'data_update_log', 'validation_cache', 'validation_presets')
      `);

      const existingTables = result.rows.map((row) => row.table_name);
      console.log('[Database] Existing tables:', existingTables);

      if (existingTables.length === 7) {
        console.log('[Database] All tables already exist');
      } else {
        console.log('[Database] Some tables are missing. Please run migrations.');
        console.log('[Database] Missing tables:', [
          'stocks',
          'sectors',
          'stock_sector_mapping',
          'kline_daily',
          'data_update_log',
          'validation_cache',
          'validation_presets',
        ].filter((t) => !existingTables.includes(t)));
      }
    } finally {
      client.release();
    }

    console.log('[Database] Initialization complete');
  } catch (error) {
    console.error('[Database] Initialization failed:', error);
    throw error;
  }
}

// ============================================================================
// Auto-initialize on module load (only in development)
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  // Test connection on module load in development
  testConnection().catch((err) => {
    console.error('[Database] Initial connection test failed:', err);
  });
}

// ============================================================================
// Exports
// ============================================================================

export * from './schema';
export { schema };
