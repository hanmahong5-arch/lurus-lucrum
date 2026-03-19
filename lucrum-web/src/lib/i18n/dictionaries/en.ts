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

  // Navigation
  "nav.strategyEditor": "Strategy Editor",
  "nav.marketplace": "Marketplace",
  "nav.validation": "Validation",
  "nav.trading": "Trading",
  "nav.scanner": "Scanner",
  "nav.agents": "Agents",
  "nav.history": "History",
  "nav.insights": "Insights",
  "nav.advisor": "Advisor",
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
};

export default en;
