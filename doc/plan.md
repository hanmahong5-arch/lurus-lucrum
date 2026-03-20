# Lucrum 平台全面升级计划 | Platform Comprehensive Upgrade Plan

> **版本 / Version**: v2.0
> **创建日期 / Created**: 2026-01-23
> **最后更新 / Last Updated**: 2026-01-24
> **预计工期 / Timeline**: 6-8周 / 6-8 weeks
> **风险等级 / Risk Level**: 中高 / Medium-High（涉及核心架构改造）

---

## 🎯 执行摘要 | Executive Summary

本计划旨在对Lucrum AI量化交易平台进行**全面升级**，包括bug修复、UI优化、用户系统改造、以及后端AI Agent框架升级。

This plan aims to comprehensively upgrade the Lucrum AI quantitative trading platform, including bug fixes, UI optimization, user system renovation, and backend AI Agent framework upgrades.

### 核心目标 | Core Objectives

| 类别 | 需求 | 优先级 | 状态 |
|------|------|--------|------|
| 🐛 **Bug修复** | 多空辩论数据格式错误 | P0 | ✅ 已完成 |
| 🐛 **Bug修复** | 策略验证页面选择器 | P0 | ✅ 已完成 |
| 🎨 **UI优化** | 代码框折叠、命名、排版 | P1 | ✅ 已完成 |
| 👤 **用户系统** | 账户隔离、登录状态显示 | P0 | ✅ 已完成 |
| 🤖 **Agent升级** | LangChain/LangGraph集成 | P1 | ✅ 已完成 |
| 📊 **数据增强** | 历史数据采集、缓存优化 | P1 | ✅ 已完成 |
| 💼 **交易面板** | 功能完整性、信息展示 | P2 | ✅ 已完成 |

---

## 📋 实施阶段 | Implementation Phases

### Phase 1: Bug修复与快速优化 ✅ 已完成

**完成日期**: 2026-01-23

**已完成项**:
- [x] 修复多空辩论Bug（participants字段缺失）
- [x] 策略代码框默认折叠（`defaultCollapsed = true`）
- [x] "AI策略助手"改名为"策略助手"
- [x] 策略验证页面选择器修复（API数据格式适配）
- [x] 验证排版无重叠

### Phase 2: 数据库Schema与用户系统 ✅ 已完成

**完成日期**: 2026-01-23

**已实现数据库表**:
- [x] `users` - 用户认证表
- [x] `userPreferences` - 用户偏好表
- [x] `userDrafts` - 草稿存储表
- [x] `tenants`, `tenantMembers` - 多租户支持
- [x] `strategyHistory` - 策略历史（版本控制）
- [x] `backtestHistory` - 回测历史
- [x] `tradingHistory` - 交易历史

**已实现功能**:
- [x] `withUser` 认证中间件
- [x] `withRole` 角色级访问控制
- [x] Dashboard统一头部组件（账户状态显示）

### Phase 3: LangGraphJS + Agent Protocol集成 ✅ 已完成

**完成日期**: 2026-01-23

**依赖安装**:
- [x] `@langchain/langgraph` 0.2.38
- [x] `@langchain/core` 0.3.26
- [x] `@langchain/openai` 0.3.17

**Agent Protocol API**:
- [x] `/api/agent-protocol/runs` - 无状态执行
- [x] `/api/agent-protocol/runs/stream` - 流式执行
- [x] `/api/agent-protocol/threads` - 会话管理
- [x] `/api/agent-protocol/threads/[id]` - 会话详情
- [x] `/api/agent-protocol/threads/[id]/runs` - 会话中运行
- [x] `/api/agent-protocol/store/items` - 记忆存储

**LangGraphJS实现**:
- [x] `graphs/advisor-graph.ts` - 投资顾问Graph
- [x] `graphs/types.ts` - 状态类型定义
- [x] `tools/indicator-tools.ts` - 技术指标Tools
- [x] `tools/market-tools.ts` - 市场数据Tools
- [x] `stores/thread-store.ts` - 会话存储

### Phase 4: 历史记录与交易面板增强 ✅ 已完成

**完成日期**: 2026-01-23

**已实现功能**:
- [x] 历史记录页面 `/dashboard/history`
- [x] 五档行情组件 `OrderbookPanel`
- [x] 技术指标面板 `IndicatorQuickPanel`
- [x] Dashboard统一头部（所有页面）
- [x] 账户状态显示（用户角色徽章）

### Phase 5: 数据采集专项实施 ✅ 已完成

**完成日期**: 2026-01-23

**已实现功能**:
- [x] K线数据持久化模块 `kline-persister.ts`
- [x] 按需数据采集API `/api/data/fetch`
- [x] 回测API自动持久化
- [x] 数据导入脚本 `import-initial-data.ts`

### Phase 6: 紧急修复 v1.2.1 ✅ 已完成

**完成日期**: 2026-01-23

**已实现功能**:
- [x] 风险声明组件 `RiskDisclaimer`
- [x] 登录/注册页面风险提示
- [x] 三道六术改为可选上下文
- [x] 大师视角战法核心增强

---

## 📊 技术架构 | Technical Architecture

### 技术栈 | Technology Stack

| 层级 | 技术 | 版本 |
|------|------|------|
| 运行时 | Bun | 1.1+ |
| 前端框架 | Next.js | 15.1.0 |
| Agent框架 | LangGraphJS | 0.2.38 |
| 数据库 | PostgreSQL + Drizzle ORM | 0.38.0 |
| 缓存 | Redis (IORedis) | 5.9.2 |
| 认证 | NextAuth.js | 5.0.0-beta.25 |

### 架构总览 | Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 15 Frontend                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Dashboard  │  │   Trading   │  │   Strategy Editor   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Protocol API Layer (框架无关)            │
│  ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌─────────────┐ │
│  │ /runs   │  │ /threads  │  │ /store  │  │  /agents    │ │
│  └─────────┘  └───────────┘  └─────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  LangGraphJS 0.2.38 Engine                  │
│  ┌───────────────────┐  ┌────────────────────────────────┐ │
│  │  Supervisor Agent │  │      11 Analyst Agents         │ │
│  │   (Orchestrator)  │──│ Technical | Fundamental | Risk │ │
│  └───────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data & LLM Layer                          │
│  ┌──────────────┐  ┌───────────┐  ┌─────────────────────┐ │
│  │  PostgreSQL  │  │   Redis   │  │ DeepSeek/Anthropic  │ │
│  │  (Drizzle)   │  │  (Cache)  │  │      LLM API        │ │
│  └──────────────┘  └───────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ 验收标准 | Acceptance Criteria

### 功能性标准

- [x] 多空辩论能正常启动并完成辩论
- [x] 策略代码框默认折叠
- [x] 所有"AI策略助手"改为"策略助手"
- [x] 策略验证选择器正确显示策略和板块
- [x] 用户登录后看到各自的策略/回测历史
- [x] Agent Protocol API完整实现
- [x] 五档行情、技术指标面板正常工作

### 性能标准

- API响应时间 <100ms（缓存命中）
- API响应时间 <3s（API调用）
- 缓存命中率 ≥85%

### 安全标准

- 无SQL注入漏洞
- 无XSS漏洞
- 用户数据完全隔离

---

## 📚 关键文件清单 | Critical Files

### Agent Protocol API
- `src/app/api/agent-protocol/runs/route.ts`
- `src/app/api/agent-protocol/threads/route.ts`
- `src/app/api/agent-protocol/store/items/route.ts`

### LangGraphJS
- `src/lib/agent/graphs/advisor-graph.ts`
- `src/lib/agent/tools/indicator-tools.ts`
- `src/lib/agent/tools/market-tools.ts`

### 数据库Schema
- `src/lib/db/schema.ts`

### 用户系统
- `src/lib/auth/with-user.ts`
- `src/components/dashboard/dashboard-header.tsx`

### 数据采集
- `src/lib/backtest/kline-persister.ts`
- `src/app/api/data/fetch/route.ts`

---

## 🚀 后续规划 | Future Enhancements

### 短期 | Short-term (1-2周)
- [ ] 添加草稿历史面板UI
- [ ] 实现撤销/重做快捷键
- [ ] 添加K线数据监控仪表板

### 中期 | Medium-term (1个月)
- [ ] 实现策略版本比较功能
- [ ] 添加数据质量自动报警
- [ ] 优化大数据量K线性能

### 长期 | Long-term (3个月)
- [ ] 云端策略同步
- [ ] 协作编辑功能
- [ ] AI驱动的数据异常检测

---

**文档版本 / Document Version**: v2.0
**最后更新 / Last Updated**: 2026-01-24
