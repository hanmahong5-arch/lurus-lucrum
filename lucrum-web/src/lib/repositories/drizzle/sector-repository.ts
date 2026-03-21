/**
 * Drizzle ORM implementation of ISectorRepository
 *
 * Handles sector/industry classification queries and
 * sector-to-stock membership resolution.
 *
 * @module lib/repositories/drizzle/sector-repository
 */

import { eq, asc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sectors, type Sector, type Stock } from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type { ISectorRepository, SectorStockFilter } from '../interfaces';
import { DrizzleStockRepository } from './stock-repository';

export class DrizzleSectorRepository implements ISectorRepository {
  private readonly stockRepo: DrizzleStockRepository;

  constructor(private readonly db: NodePgDatabase<typeof schema>) {
    this.stockRepo = new DrizzleStockRepository(db);
  }

  async findByCode(code: string): Promise<Sector | null> {
    const result = await this.db
      .select()
      .from(sectors)
      .where(eq(sectors.code, code))
      .limit(1);
    return result[0] ?? null;
  }

  async listAll(level?: number): Promise<Sector[]> {
    const baseQuery = this.db.select().from(sectors);
    const filtered = level !== undefined
      ? baseQuery.where(eq(sectors.level, level))
      : baseQuery;
    return filtered.orderBy(asc(sectors.code));
  }

  async getStocks(
    sectorCode: string,
    filters?: SectorStockFilter,
  ): Promise<Stock[]> {
    // Delegates to the stock repository which handles the join logic
    return this.stockRepo.findBySector(sectorCode, filters);
  }
}
