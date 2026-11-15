import { Pool, type PoolConfig, type QueryResultRow } from 'pg';

export class Database {
  private readonly pool: Pool;
  constructor(config: PoolConfig) {
    this.pool = new Pool({ ...config, max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 });
  }
  async query<T extends QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(sql, [...params]);
    return result.rows;
  }
  async transaction<T>(callback: (query: <R extends QueryResultRow>(sql: string, params?: readonly unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const run = async <R extends QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<R[]> =>
        (await client.query<R>(sql, [...params])).rows;
      const value = await callback(run);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async close(): Promise<void> { await this.pool.end(); }
}
