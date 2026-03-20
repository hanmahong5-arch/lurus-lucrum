# Lurus Lucrum Android APP Development Plan

## 1. Technology Selection / 技术选型

### Recommended: React Native (Expo SDK 52+)

| Candidate | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **React Native (Expo)** | 复用现有 TS/React 代码 60%+；团队已熟悉 React 生态；Expo EAS 构建链成熟 | 复杂图表性能需 native module | **Selected** |
| Flutter | 高性能渲染、跨平台一致性 | 需要学 Dart、零代码复用 | Pass |
| Kotlin Native | 最佳性能、原生体验 | 开发成本高、无法复用前端代码 | Pass |
| 增强 PWA | 零成本、已有基础 | 无推送通知（国内）、无法上架应用商店、体验差 | 补充方案 |

**Core Rationale**:
- lucrum-web 已有 22 个 custom hooks、30+ lib modules，大量可直接移植
- Zustand + React Query + Zod 在 RN 中完全兼容
- lightweight-charts 需替换为 react-native-wagmi-charts 或自研 native module
- Expo Router (file-based routing) 与 Next.js 路由思路一致

---

## 2. Feature Scope / 功能范围 (MVP → Full)

### Phase 1: MVP (6-8 weeks)
> Core loop: Login → View Market → AI Chat → Backtest → View Results

| Module | Features | Priority |
|--------|----------|----------|
| **Authentication** | Zitadel OIDC Login/Register, Token refresh, Biometric unlock | P0 |
| **Market Data** | Stock list, K-line chart, Real-time quotes, Watchlist | P0 |
| **AI Advisor** | Chat interface, Streaming response (SSE), History | P0 |
| **Strategy** | View strategies, Parameter editing, AI code generation | P0 |
| **Backtest** | Run backtest, Results dashboard (metrics + chart), History | P0 |
| **Account** | Profile, Subscription status, Quota usage | P0 |
| **Notifications** | Push notifications (FCM), In-app notification center | P1 |

### Phase 2: Enhanced (4-6 weeks)
| Module | Features | Priority |
|--------|----------|----------|
| **Trading Panel** | Orderbook, One-click trade, Position management | P1 |
| **Strategy Scanner** | Sector scanning, Multi-stock validation | P1 |
| **Strategy Marketplace** | Browse, Purchase, Ratings | P1 |
| **Paper Trading** | Virtual portfolio, P&L tracking | P1 |
| **Insights** | Institutional research, Market commentary | P2 |
| **Referral** | Invite friends, Reward tracking | P2 |

### Phase 3: Advanced (4-6 weeks)
| Module | Features | Priority |
|--------|----------|----------|
| **LangGraph Agents** | Custom agent workflows, Agent management | P2 |
| **Debate Mode** | Bull vs Bear AI debate view | P2 |
| **Report Export** | PDF report generation & share | P2 |
| **Offline Mode** | Cached strategies, Offline chart viewing | P2 |
| **Widget** | Home screen widget (watchlist, portfolio summary) | P3 |
| **Biometric Trading** | Fingerprint/Face confirm for trades | P3 |

---

## 3. Architecture / 架构设计

```
lurus-lucrum/
├── lucrum-web/              # Existing Next.js (unchanged)
├── lucrum-app/              # NEW: React Native (Expo)
│   ├── app/                 # Expo Router (file-based routing)
│   │   ├── (auth)/          # Auth screens (login, register)
│   │   ├── (tabs)/          # Main tab navigation
│   │   │   ├── market/      # Market data & watchlist
│   │   │   ├── strategy/    # Strategy editor & list
│   │   │   ├── advisor/     # AI advisor chat
│   │   │   ├── portfolio/   # Portfolio & backtest history
│   │   │   └── profile/     # Account & settings
│   │   ├── backtest/        # Backtest execution & results
│   │   ├── trading/         # Trading panel
│   │   ├── scanner/         # Strategy scanner
│   │   ├── marketplace/     # Strategy marketplace
│   │   └── _layout.tsx      # Root layout
│   ├── components/          # UI components
│   │   ├── charts/          # K-line & metrics charts
│   │   ├── advisor/         # AI chat bubbles, streaming
│   │   ├── strategy/        # Strategy editor (simplified)
│   │   ├── backtest/        # Results panels
│   │   ├── trading/         # Orderbook, indicators
│   │   ├── common/          # Shared UI primitives
│   │   └── feedback/        # Toast, loading, error
│   ├── lib/                 # Business logic (REUSE from lucrum-web)
│   │   ├── api/             # API client (axios/ky)
│   │   ├── auth/            # Zitadel OIDC (expo-auth-session)
│   │   ├── stores/          # Zustand stores (reuse)
│   │   ├── types/           # TypeScript types (reuse)
│   │   ├── hooks/           # Custom hooks (adapt from web)
│   │   ├── financial/       # Decimal.js calculations (reuse)
│   │   ├── i18n/            # i18n (reuse)
│   │   └── utils/           # Utilities (reuse)
│   ├── assets/              # Images, fonts, icons
│   ├── constants/           # App constants, theme
│   ├── app.json             # Expo config
│   ├── eas.json             # EAS Build config
│   ├── package.json
│   └── tsconfig.json
└── shared/                  # NEW: Shared code between web & app
    ├── types/               # Domain types (Strategy, Backtest, Stock)
    ├── constants/           # Business constants
    ├── validators/          # Zod schemas
    └── financial/           # Decimal.js calculations
```

### 3.1 API Communication Layer

```
Mobile App ──► lucrum-web API Routes ──► PostgreSQL / Redis / AI Services
                   (existing)

Mobile App ──► lurus-api (api.lurus.cn) ──► Auth, Billing, Quota
                   (existing)
```

**Key Point**: APP 不直连数据库，100% 通过现有 Next.js API Routes + lurus-api 通信。
无需新增后端，仅需为移动端优化部分 API response（分页、字段裁剪）。

### 3.2 Authentication Flow

```
App Launch
  ├── expo-auth-session (OIDC Authorization Code + PKCE)
  │     └── Zitadel (auth.lurus.cn)
  ├── Token stored in expo-secure-store (Keychain/Keystore)
  ├── Auto-refresh via interceptor
  └── Biometric unlock (expo-local-authentication)
```

### 3.3 State Management (Reuse Strategy)

| Layer | Web (lucrum-web) | App (lucrum-app) | Reuse? |
|-------|------------------|-------------------|--------|
| Server State | React Query | React Query | 100% hooks reuse |
| Client State | Zustand | Zustand | 95% store reuse |
| Persistence | localStorage | MMKV (react-native-mmkv) | Adapter pattern |
| Form | React Hook Form | React Hook Form | 100% |
| Validation | Zod | Zod | 100% |

### 3.4 Code Reuse Map

| Module | Reuse Rate | Adaptation Needed |
|--------|-----------|-------------------|
| `lib/types/` | 100% | None |
| `lib/financial/` | 100% | None |
| `lib/stores/` | 95% | Replace localStorage adapter |
| `hooks/useBilling` | 90% | API client swap |
| `hooks/use-streaming-chat` | 80% | SSE → RN EventSource polyfill |
| `hooks/use-websocket` | 80% | Use RN WebSocket API |
| `components/` | 0% | Full rewrite (RN components) |
| `lib/backtest/` | 0% | Server-side only, APP calls API |

---

## 4. Key Technical Decisions / 关键技术决策

### 4.1 Charting Solution (K-line)
| Option | Description | Recommendation |
|--------|-------------|----------------|
| `react-native-wagmi-charts` | Lightweight, candlestick support | MVP phase |
| `victory-native` + `react-native-skia` | High performance, custom rendering | Phase 2 |
| Custom Skia module | Maximum control, best performance | Phase 3 if needed |

### 4.2 Push Notifications
- **FCM** (Firebase Cloud Messaging) via `expo-notifications`
- lurus-notification service already supports FCM channel
- Deep link: `lucrum://backtest/{id}`, `lucrum://advisor/chat`

### 4.3 Real-time Data
- **WebSocket**: Stock quotes via RN native WebSocket
- **SSE**: AI streaming responses via `react-native-sse` or EventSource polyfill
- **NATS**: Not direct — consume via WebSocket proxy (lurus-notification)

### 4.4 Offline Strategy
| Data | Offline Policy |
|------|---------------|
| Watchlist | Cache last snapshot, show stale indicator |
| Strategy list | Full offline access (MMKV) |
| K-line history | Cache last 30 days per stock |
| Backtest results | Cache last 10 results |
| AI Chat history | Cache last 50 messages |
| Market quotes | No offline (show last known + timestamp) |

### 4.5 Security
- Token storage: `expo-secure-store` (Android Keystore)
- Certificate pinning: `expo-ssl-pinning` for API calls
- Root/jailbreak detection: `expo-device` checks
- Biometric: `expo-local-authentication` for trade confirmation
- No sensitive data in AsyncStorage/MMKV (only non-sensitive cache)

---

## 5. UI/UX Design / 界面设计

### 5.1 Navigation Structure

```
Bottom Tabs (5):
├── Market      行情    (Stock list, K-line chart, Watchlist)
├── Strategy    策略    (My strategies, AI generate, Editor)
├── Advisor     AI顾问  (Chat, Debate, History)
├── Portfolio   组合    (Backtest history, Paper trading, P&L)
└── Profile     我的    (Account, Subscription, Settings)
```

### 5.2 Design System Adaptation (Dark Mode First)

Web design system → Mobile adaptation:

| Web Token | Mobile Value | Notes |
|-----------|-------------|-------|
| `bg-void` (#09090b) | System background | Same |
| `bg-surface` (#18181b) | Card/Panel background | Same |
| `text-profit` (green) | 涨 color | Same (A-share convention) |
| `text-loss` (red) | 跌 color | Same |
| `text-ai` (purple) | AI indicator | Same |
| Font: Inter | System font (Noto Sans for CN) | Platform native |
| Font: JetBrains Mono | JetBrains Mono (bundled) | For code & numbers |
| `tabular-nums` | `fontVariant: ['tabular-nums']` | Mandatory for prices |

### 5.3 Mobile-Specific UX Patterns

| Pattern | Implementation |
|---------|---------------|
| Pull-to-refresh | All list screens |
| Swipe actions | Strategy card: edit/delete/backtest |
| Haptic feedback | Trade execution, backtest complete |
| Gesture navigation | Swipe between K-line timeframes |
| Quick actions | Long-press stock → Add watchlist / AI analyze |
| Share sheet | Share backtest report as image/PDF |
| Bottom sheet | Stock detail, Filter panel |
| Skeleton loading | All data screens |

### 5.4 Screen Mockup List (Key Screens)

1. **Splash Screen** — Logo + loading animation
2. **Login** — Zitadel OIDC button + biometric
3. **Market Home** — Watchlist + sector overview + trending
4. **Stock Detail** — K-line (fullscreen landscape) + indicators + AI quick analysis
5. **Strategy List** — Cards with last backtest result preview
6. **Strategy Editor** — Simplified: AI prompt + parameter sliders (no code view on mobile)
7. **AI Advisor Chat** — Bubble UI + streaming + agent status indicator
8. **Backtest Running** — Progress bar + live metric updates
9. **Backtest Result** — Scrollable: equity curve + metrics grid + trade list
10. **Portfolio Dashboard** — Summary cards + P&L chart
11. **Settings** — Theme, notification preferences, data management

---

## 6. API Optimization for Mobile / API 移动端优化

### 6.1 New Endpoints Needed (in lucrum-web)

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /api/mobile/market/summary` | Compact market overview | Aggregated data, single request |
| `GET /api/mobile/watchlist` | User watchlist with latest quotes | Merged stock + quote |
| `GET /api/mobile/strategy/list` | Strategy list with mini metrics | Compact fields |
| `POST /api/mobile/push/register` | FCM token registration | For push notifications |

### 6.2 Existing API Adaptations

| Current API | Mobile Optimization |
|-------------|-------------------|
| `GET /api/stocks` | Add `?fields=code,name,price,change` for compact mode |
| `POST /api/backtest/unified` | Add `?format=mobile` for simplified results |
| `POST /api/advisor/chat` | Already SSE streaming, compatible |
| `GET /api/data/fetch` | Add pagination `?page=1&limit=50` |

---

## 7. Development Milestones / 开发里程碑

### Sprint 1 (Week 1-2): Foundation
- [ ] Expo project scaffolding (`lucrum-app/`)
- [ ] Expo Router navigation structure (5 tabs)
- [ ] Design system setup (theme, colors, typography)
- [ ] API client layer (axios + interceptors + auth)
- [ ] Zitadel OIDC authentication (expo-auth-session)
- [ ] Secure token storage (expo-secure-store)
- [ ] Shared types extraction (`shared/` directory)

### Sprint 2 (Week 3-4): Market & Data
- [ ] Stock list screen (search, filter, favorites)
- [ ] K-line chart component (react-native-wagmi-charts)
- [ ] Watchlist management (add/remove/reorder)
- [ ] Market data hooks (adapt from web)
- [ ] Real-time quote WebSocket connection
- [ ] Pull-to-refresh & skeleton loading

### Sprint 3 (Week 5-6): AI & Strategy
- [ ] AI Advisor chat screen (bubble UI)
- [ ] SSE streaming integration (react-native-sse)
- [ ] Chat history persistence
- [ ] Strategy list screen
- [ ] Strategy detail view (parameters + last backtest)
- [ ] AI strategy generation (prompt → code)

### Sprint 4 (Week 7-8): Backtest & Account
- [ ] Backtest trigger & progress screen
- [ ] Backtest results dashboard (metrics + equity curve)
- [ ] Backtest history list
- [ ] Account/Profile screen
- [ ] Subscription & billing display
- [ ] Quota usage visualization
- [ ] Push notification setup (FCM)

### Sprint 5 (Week 9-10): Polish & Release
- [ ] Error handling & edge cases
- [ ] Offline cache strategy
- [ ] Performance optimization (FlatList, memo, lazy screens)
- [ ] Accessibility (TalkBack support)
- [ ] App icon, splash screen, store assets
- [ ] EAS Build configuration (APK + AAB)
- [ ] Internal testing (TestFlight equivalent: Google Play Internal Testing)
- [ ] Bug fixes from internal testing

### Sprint 6 (Week 11-12): Store Release
- [ ] Google Play Store listing (screenshots, description, privacy policy)
- [ ] APK signing & release
- [ ] Crash reporting setup (Sentry)
- [ ] Analytics integration (basic events)
- [ ] Production monitoring

---

## 8. Dependencies / 核心依赖

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-auth-session": "~6.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-notifications": "~0.30.0",
    "expo-local-authentication": "~15.0.0",
    "expo-haptics": "~14.0.0",
    "expo-image": "~2.0.0",
    "expo-linking": "~7.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-device": "~7.0.0",

    "react-native": "0.76.x",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.21.0",
    "react-native-safe-area-context": "~4.14.0",
    "react-native-screens": "~4.4.0",
    "react-native-mmkv": "^3.2.0",
    "react-native-wagmi-charts": "^2.3.0",
    "react-native-sse": "^1.2.0",

    "@tanstack/react-query": "^5.60.0",
    "zustand": "^4.5.7",
    "zod": "^3.25.0",
    "decimal.js": "^10.6.0",
    "axios": "^1.7.0",
    "date-fns": "^4.1.0",
    "react-hook-form": "^7.54.0",
    "@hookform/resolvers": "^3.9.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.0.0",
    "maestro": "latest"
  }
}
```

---

## 9. Build & Distribution / 构建与分发

### 9.1 EAS Build Configuration

```json
// eas.json
{
  "cli": { "version": ">= 13.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "credentialsSource": "remote"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./play-store-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 9.2 Distribution Strategy

| Channel | Method | Target |
|---------|--------|--------|
| Internal Test | EAS Build → APK direct install | Dev team |
| Beta | Google Play Internal Testing | Early adopters |
| Production | Google Play Store | Public |
| China Alt | APK download from lurus.cn + auto-update | No GMS users |

### 9.3 China Market Considerations
- **No Google Play in China**: Provide APK download + in-app update mechanism
- **Push without FCM**: Use vendor push (Xiaomi/Huawei/OPPO Push SDK) or WebSocket fallback
- **App Store alternatives**: Tencent MyApp, Huawei AppGallery, Xiaomi Store
- **ICP compliance**: Already handled at lurus.cn level

---

## 10. Performance Targets / 性能目标

| Metric | Target |
|--------|--------|
| Cold start | < 2s |
| Screen transition | < 300ms |
| K-line chart render (1000 candles) | < 500ms |
| AI response first token | < 1s (SSE) |
| Backtest result display | < 1s after completion |
| Memory usage (idle) | < 150MB |
| APK size | < 30MB |
| Crash-free rate | > 99.5% |

---

## 11. Risk Assessment / 风险评估

| Risk | Impact | Mitigation |
|------|--------|------------|
| K-line chart性能不足 | High | Phase 1 用 wagmi-charts，Phase 2 考虑 Skia 自绘 |
| 国内无 FCM | Medium | WebSocket 长连接 fallback + 厂商推送 SDK |
| SSE streaming 在 RN 中兼容性 | Medium | react-native-sse 库 + polyfill 测试 |
| Expo managed workflow 限制 | Low | 随时可 eject 到 bare workflow |
| 代码复用率低于预期 | Medium | 先抽取 shared/ 验证，再扩大复用范围 |
| Zitadel OIDC mobile flow | Low | expo-auth-session 已支持 PKCE，已有成功案例 |

---

## 12. Summary / 总结

| Dimension | Decision |
|-----------|----------|
| **Framework** | React Native (Expo SDK 52) |
| **Code Reuse** | ~60% business logic from lucrum-web |
| **Backend Changes** | Minimal (4 new mobile-optimized endpoints) |
| **MVP Timeline** | 8 weeks (5 sprints) |
| **Full App Timeline** | 16-18 weeks (+ Phase 2 & 3) |
| **Team Size** | 1-2 RN developers (can be same team) |
| **Distribution** | Google Play + APK direct download (China) |
| **Key Risk** | Chart performance, China push notifications |
