/**
 * Drizzle ORM implementation of ITeamRepository
 *
 * Encapsulates all team collaboration database queries.
 */

import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  tenants,
  tenantMembers,
  tenantInvitations,
  type Tenant,
  type NewTenant,
  type TenantInvitation,
} from '@/lib/db/schema';
import type * as schema from '@/lib/db/schema';
import type { ITeamRepository, TeamMemberRow } from '../interfaces';

export class DrizzleTeamRepository implements ITeamRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findById(id: number): Promise<Tenant | null> {
    const result = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findByUser(userId: string): Promise<Tenant[]> {
    const memberships = await this.db
      .select({ tenant: tenants })
      .from(tenantMembers)
      .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
      .where(eq(tenantMembers.userId, userId));
    return memberships.map((m) => m.tenant);
  }

  async create(data: Omit<NewTenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant | null> {
    const result = await this.db.insert(tenants).values(data).returning();
    const team = result[0];
    if (!team) return null;

    // Auto-add owner as member
    await this.db.insert(tenantMembers).values({
      tenantId: team.id,
      userId: data.ownerId,
      role: 'owner',
      status: 'accepted',
    });

    return team;
  }

  async update(id: number, data: { name?: string; settings?: string }): Promise<void> {
    await this.db
      .update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id));
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(tenants).where(eq(tenants.id, id));
  }

  async getMemberCount(teamId: number): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, teamId));
    return result[0]?.count ?? 0;
  }

  async getMembers(teamId: number): Promise<TeamMemberRow[]> {
    // User name/email/avatar live in Zitadel (SSOT). Return null here;
    // callers that need display info should resolve via identity client.
    const rows = await this.db
      .select({
        id: tenantMembers.id,
        userId: tenantMembers.userId,
        role: tenantMembers.role,
        status: tenantMembers.status,
        joinedAt: tenantMembers.joinedAt,
      })
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, teamId));
    return rows.map((r) => ({ ...r, name: null, email: '', avatar: null }));
  }

  async checkAccess(
    userId: string,
    teamId: number
  ): Promise<{ hasAccess: boolean; role: string | null }> {
    const member = await this.db
      .select({ role: tenantMembers.role })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, teamId)))
      .limit(1);

    if (member.length === 0) return { hasAccess: false, role: null };
    return { hasAccess: true, role: member[0]!.role };
  }

  async updateMemberRole(teamId: number, userId: string, role: string): Promise<void> {
    await this.db
      .update(tenantMembers)
      .set({ role })
      .where(and(eq(tenantMembers.tenantId, teamId), eq(tenantMembers.userId, userId)));
  }

  async removeMember(teamId: number, userId: string): Promise<void> {
    await this.db
      .delete(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, teamId), eq(tenantMembers.userId, userId)));
  }

  async addMember(teamId: number, userId: string, role: string, invitedBy?: string): Promise<void> {
    await this.db.insert(tenantMembers).values({
      tenantId: teamId,
      userId,
      role,
      status: 'accepted',
      invitedBy: invitedBy ?? null,
    });
  }

  async createInvitation(data: {
    tenantId: number;
    email: string;
    role: string;
    token: string;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<TenantInvitation | null> {
    const result = await this.db
      .insert(tenantInvitations)
      .values({ ...data, status: 'pending' })
      .returning();
    return result[0] ?? null;
  }

  async findInvitationByToken(token: string): Promise<TenantInvitation | null> {
    const result = await this.db
      .select()
      .from(tenantInvitations)
      .where(and(eq(tenantInvitations.token, token), eq(tenantInvitations.status, 'pending')))
      .limit(1);
    return result[0] ?? null;
  }

  async updateInvitationStatus(id: number, status: string): Promise<void> {
    await this.db
      .update(tenantInvitations)
      .set({ status })
      .where(eq(tenantInvitations.id, id));
  }

  async hasPendingInvitation(teamId: number, email: string): Promise<boolean> {
    const result = await this.db
      .select({ id: tenantInvitations.id })
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, teamId),
          eq(tenantInvitations.email, email),
          eq(tenantInvitations.status, 'pending')
        )
      )
      .limit(1);
    return result.length > 0;
  }
}
