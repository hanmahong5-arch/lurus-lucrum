/**
 * English Dictionary
 * Must have the same keys as zh.ts.
 */

import type { TranslationKey } from "./zh";

const en: Record<TranslationKey, string> = {
  // Common
  "common.loading": "Loading...",
  "common.error": "Something went wrong",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.search": "Search",
  "common.close": "Close",
  "common.back": "Back",
  "common.next": "Next",
  "common.submit": "Submit",
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.share": "Share",

  // Navigation — primary 7 modules
  "nav.strategyEditor": "Workspace",
  "nav.marketplace": "Marketplace",
  "nav.validation": "Validation",
  "nav.trading": "Trading",
  "nav.analysis": "Analysis",
  "nav.advisor": "AI Advisor",
  "nav.history": "History",
  "nav.leaderboard": "Leaderboard",
  // Navigation — progressive selection (L1/L2/L3)
  "nav.quickPick": "Quick Pick",
  "nav.styleDial": "Style Dial",
  "nav.stepper": "Custom Wizard",
  "nav.monitoring": "Health",
  // Navigation — legacy (kept for backward compat)
  "nav.scanner": "Scanner",
  "nav.agents": "Agents",
  "nav.insights": "Insights",
  "nav.diagnostics": "Diagnostics",
  "nav.smartBacktest": "Smart Backtest",
  "nav.more": "More",
  "nav.settings": "Settings",
  "nav.account": "Account",
  "nav.strategies": "My Strategies",
  "nav.referral": "Referral",
  "nav.logout": "Sign Out",
  "nav.login": "Sign In",

  // Dashboard
  "dashboard.title": "AI Strategy Generator",
  "dashboard.subtitle": "Describe your trading strategy in natural language and AI generates executable code",

  // Marketplace
  "marketplace.title": "Strategy Marketplace",
  "marketplace.subtitle": "Browse community strategies, subscribe with one click. Author earns 70%",
  "marketplace.publish": "Publish Strategy",
  "marketplace.subscribe": "Subscribe",
  "marketplace.free": "Free",
  "marketplace.freeUse": "Use Free",
  "marketplace.noStrategies": "No strategies yet",
  "marketplace.popular": "Popular",
  "marketplace.newest": "Newest",
  "marketplace.cheapest": "Cheapest",
  "marketplace.all": "All",
  "marketplace.runs": "runs",
  "marketplace.subscribers": "subscribers",

  // Diagnostics
  "diagnostics.title": "Strategy Diagnostic Report",
  "diagnostics.subtitle": "AI-powered analysis and improvement suggestions based on backtest results",
  "diagnostics.noData": "Please run a backtest in the Strategy Workshop first, then return here for the diagnostic report",
  "diagnostics.goToWorkshop": "Go to Workshop",

  // Referral
  "referral.title": "Invite Friends, Share Rewards",
  "referral.subtitle": "Earn 5 LuBell for each successful referral signup.",
  "referral.code": "Your Referral Code",
  "referral.link": "Invite Link",
  "referral.totalReferrals": "Referrals",
  "referral.totalRewards": "Total Rewards (LB)",
  "referral.rules": "Reward Rules",

  // Upgrade / Roles
  "upgrade.explorer": "Explorer",
  "upgrade.trader": "Trader",
  "upgrade.pro": "Pro",
  "upgrade.enterprise": "Enterprise",
  "role.member": "Member",
  "role.noName": "No name set",

  // Header
  "header.quota": "Quota",
  "header.demoAccount": "Demo",

  // Risk
  "risk.disclaimer": "Risk Disclaimer",
  "risk.disclaimerText": "Strategies generated are for educational purposes only and do not constitute investment advice.",

  // Team
  "nav.team": "Team",
  "team.title": "Team Management",
  "team.myTeams": "My Teams",
  "team.members": "Members",
  "team.activity": "Activity",
  "team.create": "Create Team",
  "team.createTitle": "Create New Team",
  "team.name": "Team Name",
  "team.slug": "Team Slug",
  "team.slugHint": "Lowercase alphanumeric and hyphens only",
  "team.memberCount": "{count} members",
  "team.invite": "Invite Member",
  "team.inviteTitle": "Invite New Member",
  "team.inviteEmail": "Email Address",
  "team.inviteRole": "Role",
  "team.inviteSend": "Send Invitation",
  "team.inviteSuccess": "Invitation sent",
  "team.removeMember": "Remove Member",
  "team.removeConfirm": "Are you sure you want to remove this member?",
  "team.changeRole": "Change Role",
  "team.leaveTeam": "Leave Team",
  "team.deleteTeam": "Delete Team",
  "team.deleteConfirm": "Are you sure you want to delete this team? This cannot be undone.",
  "team.noTeams": "No teams yet",
  "team.createFirst": "Create your first team to start collaborative trading",
  "team.scope.personal": "Personal",
  "team.scope.switch": "Switch Scope",
  "team.role.owner": "Owner",
  "team.role.admin": "Admin",
  "team.role.member": "Member",
  "team.role.viewer": "Viewer",

  // Notifications
  "notification.title": "Notifications",
  "notification.empty": "No notifications",
  "notification.markAllRead": "Mark all as read",
  "notification.markRead": "Mark as read",
  "notification.unread": "{count} unread",

  // Activity
  "activity.title": "Team Activity",
  "activity.empty": "No activity yet",
  "activity.strategy_created": "created a new strategy",
  "activity.strategy_updated": "updated a strategy",
  "activity.backtest_run": "ran a backtest",
  "activity.member_invited": "invited a new member",
  "activity.member_joined": "joined the team",
  "activity.member_removed": "removed a member",
  "activity.member_role_changed": "changed a member role",
  "activity.team_updated": "updated team settings",
};

export default en;
