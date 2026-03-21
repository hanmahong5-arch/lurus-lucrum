/**
 * Drizzle ORM implementation of IStrategyRepository
 *
 * Manages version-controlled strategy storage and retrieval.
 *
 * @module lib/repositories/drizzle/strategy-repository
 */

import { eq, and, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  strategyHistory,
  type StrategyHistory,
  type NewStrategyHistory,
} from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type { IStrategyRepository, UserStrategyFilter } from '../interfaces';

export class DrizzleStrategyRepository implements IStrategyRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async save(data: NewStrategyHistory): Promise<number> {
    const result = await this.db
      .insert(strategyHistory)
      .values(data)
      .returning({ id: strategyHistory.id });

    const row = result[0];
    if (!row) {
      throw new Error('Failed to insert strategy history: no ID returned');
    }
    return row.id;
  }

  async findById(id: number): Promise<StrategyHistory | null> {
    const result = await this.db
      .select()
      .from(strategyHistory)
      .where(eq(strategyHistory.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findByUser(
    userId: string,
    filters?: UserStrategyFilter,
  ): Promise<StrategyHistory[]> {
    const { isActive = true, limit = 20 } = filters ?? {};

    const conditions = [eq(strategyHistory.userId, userId)];
    if (isActive !== undefined) {
      conditions.push(eq(strategyHistory.isActive, isActive));
    }

    return this.db.query.strategyHistory.findMany({
      where: and(...conditions),
      orderBy: [desc(strategyHistory.createdAt)],
      limit,
    });
  }
}
