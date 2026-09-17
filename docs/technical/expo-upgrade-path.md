# Expo SDK upgrade path (G51, 2026-09-17)

**Where we are:** Expo SDK **52** (`expo ~52.0.49`, React Native 0.76.9, React 18.3.1), aligned to its
own patch versions by `npx expo install --fix`. `expo-doctor` 17/18 (see "accepted findings").

**Where current is:** SDK **57** (React Native 0.86, React 19.2.3) — **5 majors** to cross.
Source: <https://docs.expo.dev/versions/latest/> (SDK table: 54 → RN 0.81 / React 19.1, 55 → RN 0.83 / React 19.2.0, 56 → RN 0.85, 57 → RN 0.86).

**This note sizes the upgrade; it does not perform it.** Each hop is its own change with its own
regression pass (G50's CI + a device session), because a failed install and a failed upgrade
landing together cannot be told apart.

## What hits THIS app, per hop

| Hop | Change that affects GymPal | Evidence in this repo | Rough size |
|---|---|---|---|
| 52 → 53 | New Architecture becomes the **default**; React 19 era begins | No `newArchEnabled` set, so it flips on | M — run every screen on a device; watch the charts and socket screens |
| 53 → 54 | Last SDK that still allows the Legacy Architecture | — | S — the escape hatch if 53 surfaces a native module that breaks |
| 54 → 55 | **Legacy Architecture removed** (cannot be disabled); `newArchEnabled` config removed; **`expo-av` no longer patched** (replaced by `expo-audio` / `expo-video`) | `expo-av` was declared but never imported and was **removed in G51**, so no migration needed. `react-native-chart-kit` is flagged by expo-doctor as *untested on the New Architecture* and is used by the charts | **L** — the chart library is the real risk: verify it renders on 53 first, and have a replacement chosen before 55 |
| 55 → 56 → 57 | Routine RN minor bumps (0.83 → 0.85 → 0.86), React 19.2.x | Nothing pinned to RN internals found | S each — `npx expo install --fix`, CI, device smoke |

Sources: [SDK 55 changelog](https://expo.dev/changelog/sdk-55) (Legacy Architecture removed, `expo-av` replaced),
[New Architecture guide](https://docs.expo.dev/guides/new-architecture/) (default from SDK 53),
[SDK version table](https://docs.expo.dev/versions/latest/).

## Recommended order
1. Land G50 (CI) so every hop is tested the same way.
2. 52 → 53, device pass focused on `react-native-chart-kit` screens and the Socket.IO screens (TrainerScreen, TVScreen).
3. 53 → 54. If the chart library misbehaved on 53, replace it here, while the Legacy Architecture still exists as a fallback.
4. 54 → 55 (the architecture cliff), then 56 and 57 as small hops.

## Accepted `expo-doctor` findings (2026-09-17)
- `react-native-chart-kit` — *untested on New Architecture*: accepted on SDK 52 (Legacy Architecture); it is THE item to prove on the 53 hop.
- `socket.io-client`, `uuid` — *no metadata*: pure-JavaScript libraries with no native code, so the React Native Directory check does not apply.
