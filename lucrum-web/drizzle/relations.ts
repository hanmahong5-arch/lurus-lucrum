import { relations } from "drizzle-orm/relations";
import { tenants, tenantMembers, strategyHistory, stocks, stockSectorMapping, sectors, backtestHistory, tradingHistory, marketplaceStrategies, strategyComments, strategyVersions, klineDaily, userWorkflowSessions, workflowStepCache, customAgents, customAgentRuns, notifications, strategyLikes, teamActivity, strategySubscriptions, tenantInvitations, packRuns, packRunPerformance, packRunStages } from "./schema";

export const tenantMembersRelations = relations(tenantMembers, ({one}) => ({
	tenant: one(tenants, {
		fields: [tenantMembers.tenantId],
		references: [tenants.id]
	}),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	tenantMembers: many(tenantMembers),
	strategyHistories: many(strategyHistory),
	backtestHistories: many(backtestHistory),
	tradingHistories: many(tradingHistory),
	notifications: many(notifications),
	teamActivities: many(teamActivity),
	tenantInvitations: many(tenantInvitations),
}));

export const strategyHistoryRelations = relations(strategyHistory, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [strategyHistory.tenantId],
		references: [tenants.id]
	}),
	backtestHistories: many(backtestHistory),
	tradingHistories: many(tradingHistory),
	strategyVersions: many(strategyVersions),
	marketplaceStrategies: many(marketplaceStrategies),
}));

export const stockSectorMappingRelations = relations(stockSectorMapping, ({one}) => ({
	stock: one(stocks, {
		fields: [stockSectorMapping.stockId],
		references: [stocks.id]
	}),
	sector: one(sectors, {
		fields: [stockSectorMapping.sectorId],
		references: [sectors.id]
	}),
}));

export const stocksRelations = relations(stocks, ({many}) => ({
	stockSectorMappings: many(stockSectorMapping),
	klineDailies: many(klineDaily),
}));

export const sectorsRelations = relations(sectors, ({many}) => ({
	stockSectorMappings: many(stockSectorMapping),
}));

export const backtestHistoryRelations = relations(backtestHistory, ({one}) => ({
	tenant: one(tenants, {
		fields: [backtestHistory.tenantId],
		references: [tenants.id]
	}),
	strategyHistory: one(strategyHistory, {
		fields: [backtestHistory.strategyHistoryId],
		references: [strategyHistory.id]
	}),
}));

export const tradingHistoryRelations = relations(tradingHistory, ({one}) => ({
	tenant: one(tenants, {
		fields: [tradingHistory.tenantId],
		references: [tenants.id]
	}),
	strategyHistory: one(strategyHistory, {
		fields: [tradingHistory.strategyHistoryId],
		references: [strategyHistory.id]
	}),
}));

export const strategyCommentsRelations = relations(strategyComments, ({one}) => ({
	marketplaceStrategy: one(marketplaceStrategies, {
		fields: [strategyComments.marketplaceStrategyId],
		references: [marketplaceStrategies.id]
	}),
}));

export const marketplaceStrategiesRelations = relations(marketplaceStrategies, ({one, many}) => ({
	strategyComments: many(strategyComments),
	strategyHistory: one(strategyHistory, {
		fields: [marketplaceStrategies.strategyHistoryId],
		references: [strategyHistory.id]
	}),
	strategyLikes: many(strategyLikes),
	strategySubscriptions: many(strategySubscriptions),
}));

export const strategyVersionsRelations = relations(strategyVersions, ({one}) => ({
	strategyHistory: one(strategyHistory, {
		fields: [strategyVersions.strategyHistoryId],
		references: [strategyHistory.id]
	}),
}));

export const klineDailyRelations = relations(klineDaily, ({one}) => ({
	stock: one(stocks, {
		fields: [klineDaily.stockId],
		references: [stocks.id]
	}),
}));

export const workflowStepCacheRelations = relations(workflowStepCache, ({one}) => ({
	userWorkflowSession: one(userWorkflowSessions, {
		fields: [workflowStepCache.sessionId],
		references: [userWorkflowSessions.id]
	}),
}));

export const userWorkflowSessionsRelations = relations(userWorkflowSessions, ({many}) => ({
	workflowStepCaches: many(workflowStepCache),
}));

export const customAgentRunsRelations = relations(customAgentRuns, ({one}) => ({
	customAgent: one(customAgents, {
		fields: [customAgentRuns.agentId],
		references: [customAgents.id]
	}),
}));

export const customAgentsRelations = relations(customAgents, ({many}) => ({
	customAgentRuns: many(customAgentRuns),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	tenant: one(tenants, {
		fields: [notifications.tenantId],
		references: [tenants.id]
	}),
}));

export const strategyLikesRelations = relations(strategyLikes, ({one}) => ({
	marketplaceStrategy: one(marketplaceStrategies, {
		fields: [strategyLikes.marketplaceStrategyId],
		references: [marketplaceStrategies.id]
	}),
}));

export const teamActivityRelations = relations(teamActivity, ({one}) => ({
	tenant: one(tenants, {
		fields: [teamActivity.tenantId],
		references: [tenants.id]
	}),
}));

export const strategySubscriptionsRelations = relations(strategySubscriptions, ({one}) => ({
	marketplaceStrategy: one(marketplaceStrategies, {
		fields: [strategySubscriptions.marketplaceStrategyId],
		references: [marketplaceStrategies.id]
	}),
}));

export const tenantInvitationsRelations = relations(tenantInvitations, ({one}) => ({
	tenant: one(tenants, {
		fields: [tenantInvitations.tenantId],
		references: [tenants.id]
	}),
}));

export const packRunPerformanceRelations = relations(packRunPerformance, ({one}) => ({
	packRun: one(packRuns, {
		fields: [packRunPerformance.runId],
		references: [packRuns.runId]
	}),
}));

export const packRunsRelations = relations(packRuns, ({many}) => ({
	packRunPerformances: many(packRunPerformance),
	packRunStages: many(packRunStages),
}));

export const packRunStagesRelations = relations(packRunStages, ({one}) => ({
	packRun: one(packRuns, {
		fields: [packRunStages.runId],
		references: [packRuns.runId]
	}),
}));