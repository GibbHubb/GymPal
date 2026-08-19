# GymPal — Prod Readiness

Stack: React Native · Expo · Node.js · Express · Socket.io · Railway

## Tasks (ordered — do 1/day)

### 1. Migrate backend to TypeScript + Zod
Showcase: type safety at the boundary.
- Convert `backend/` to TS strict mode
- Zod schemas for every request body + Socket.io event payload — single source of truth shared with frontend via `packages/shared-types`
- Replace ad-hoc error handling with a typed `AppError` hierarchy + express error middleware
- Structured logging with `pino`, request-id correlation, log levels per env

### 2. Socket.io reliability + auth
Showcase: real-time systems thinking.
- JWT auth on Socket.io handshake + per-event authorization (trainer vs client scoping)
- Rooms per trainer–client session, reconnection with state replay
- Heartbeat + exponential backoff on client
- Integration tests with `socket.io-client` hitting a real test server (no mocks)

### 3. E2E + CI pipeline for mobile
Showcase: you can ship RN apps, not just run them locally.
- Detox or Maestro E2E on Android emulator in CI (login → log workout → trainer sees update)
- EAS Build profile for preview APK per PR, link posted to PR
- Sentry integration (mobile + backend) with source maps uploaded in CI
- Environment config via `expo-constants` + typed `env.ts`, no hardcoded URLs
