/**
 * Chinese (Simplified) Dictionary
 * Default locale — all keys must exist here.
 */

const zh = {
  // Common
  "common.loading": "加载中...",
  "common.error": "出错了",
  "common.save": "保存",
  "common.cancel": "取消",
  "common.confirm": "确认",
  "common.delete": "删除",
  "common.edit": "编辑",
  "common.search": "搜索",
  "common.close": "关闭",
  "common.back": "返回",
  "common.next": "下一步",
  "common.submit": "提交",
  "common.copy": "复制",
  "common.copied": "已复制",
  "common.share": "分享",

  // Navigation — primary 7 modules
  "nav.strategyEditor": "策略工作台",
  "nav.marketplace": "策略市场",
  "nav.validation": "策略验证",
  "nav.trading": "交易中心",
  "nav.analysis": "分析中心",
  "nav.advisor": "AI 顾问",
  "nav.history": "历史中心",
  // Navigation — legacy (kept for backward compat)
  "nav.scanner": "扫描选板",
  "nav.agents": "分析任务",
  "nav.insights": "机构洞察",
  "nav.diagnostics": "策略诊断",
  "nav.smartBacktest": "智能回测",
  "nav.more": "更多",
  "nav.settings": "偏好设置",
  "nav.account": "账户设置",
  "nav.strategies": "我的策略",
  "nav.referral": "邀请返利",
  "nav.logout": "退出登录",
  "nav.login": "登录",

  // Dashboard
  "dashboard.title": "AI 策略生成器",
  "dashboard.subtitle": "用自然语言描述你的交易策略，AI 将自动生成可执行的策略代码",

  // Marketplace
  "marketplace.title": "策略市场",
  "marketplace.subtitle": "浏览社区策略，一键订阅使用 · 作者分润 70%",
  "marketplace.publish": "发布策略",
  "marketplace.subscribe": "订阅策略",
  "marketplace.free": "免费",
  "marketplace.freeUse": "免费使用",
  "marketplace.noStrategies": "暂无策略",
  "marketplace.popular": "热门",
  "marketplace.newest": "最新",
  "marketplace.cheapest": "低价",
  "marketplace.all": "全部",
  "marketplace.runs": "次运行",
  "marketplace.subscribers": "订阅",

  // Diagnostics
  "diagnostics.title": "策略诊断报告",
  "diagnostics.subtitle": "基于回测结果的智能分析和改进建议",
  "diagnostics.noData": "请先在策略工坊中运行回测，然后返回此页面查看诊断报告",
  "diagnostics.goToWorkshop": "前往策略工坊",

  // Referral
  "referral.title": "邀请好友，共享奖励",
  "referral.subtitle": "每成功邀请一位好友注册，你将获得 5 鹿贝奖励。",
  "referral.code": "你的邀请码",
  "referral.link": "邀请链接",
  "referral.totalReferrals": "成功邀请",
  "referral.totalRewards": "累计奖励 (LB)",
  "referral.rules": "奖励规则",

  // Upgrade / Roles
  "upgrade.explorer": "体验版",
  "upgrade.trader": "进阶版",
  "upgrade.pro": "专业版",
  "upgrade.enterprise": "企业版",
  "role.member": "会员",
  "role.noName": "未设置名称",

  // Header
  "header.quota": "配额",
  "header.demoAccount": "演示账户",

  // Risk
  "risk.disclaimer": "风险提示",
  "risk.disclaimerText": "本工具生成的策略代码仅供学习研究使用，不构成任何投资建议。",
} as const;

export type TranslationKey = keyof typeof zh;
export default zh;
