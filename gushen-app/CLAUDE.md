# gushen-app

React Native (Expo SDK 52) Android app for the GuShen AI Quantitative Trading Platform.

## Commands

```bash
# Development
bun install                    # Install dependencies
bun run dev                    # Start Expo dev server
bun run android                # Run on Android device/emulator

# Build
bun run build:dev              # EAS development build (APK)
bun run build:preview          # EAS preview build (APK)
bun run build:prod             # EAS production build (AAB)

# Quality
bun run typecheck              # TypeScript check
bun run lint                   # ESLint
bun run test                   # Jest tests
```

## Architecture

- **Expo Router** (file-based routing) — `app/` directory
- **5 Bottom Tabs**: Market | Strategy | Advisor | Portfolio | Profile
- **API Client**: `lib/api/client.ts` — axios with auth interceptors
- **Auth**: Zitadel OIDC + PKCE via expo-auth-session
- **Token Storage**: expo-secure-store (Android Keystore)
- **State**: Zustand (client) + React Query (server)
- **Persistence**: MMKV (non-sensitive cache)
- **Shared Types**: `../shared/types/` (shared with gushen-web)

## Design System

Dark mode only. Mirrors `gushen-web/docs/DESIGN_SYSTEM.md`.

- Backgrounds: `Colors.void` (#09090b), `Colors.surface` (#18181b)
- Financial data: always use `<MonoText>` with `fontVariant: ['tabular-nums']`
- Sentiment: `Colors.profit` (red/up), `Colors.loss` (green/down) — A-share convention
- AI elements: `Colors.ai` (#a78bfa)

## Key Rules

- All API calls go through gushen-web API routes or lurus-api. No direct DB access.
- Use `Decimal.js` for financial calculations (same as web).
- Tokens stored in SecureStore only — never in MMKV or AsyncStorage.
