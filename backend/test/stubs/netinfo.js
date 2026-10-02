// G48 — stands in for @react-native-community/netinfo when the app's sync engine runs in
// the backend suite (see vitest.config.mjs). The tests drive runSync directly.
export default { addEventListener: () => () => {} };
