// In-memory stand-in for @react-native-async-storage/async-storage, enough of its API for
// the session and sync-queue modules. Use with:
//   vi.mock('@react-native-async-storage/async-storage', () => import('./asyncStorageMock.js'))
export const store = new Map();

const AsyncStorage = {
  async getItem(k) { return store.has(k) ? store.get(k) : null; },
  async setItem(k, v) {
    if (typeof v !== 'string') throw new Error(`AsyncStorage.setItem(${k}) needs a string, got ${typeof v}`);
    store.set(k, v);
  },
  async removeItem(k) { store.delete(k); },
  async multiGet(keys) { return keys.map((k) => [k, store.has(k) ? store.get(k) : null]); },
  async multiSet(pairs) { for (const [k, v] of pairs) await AsyncStorage.setItem(k, v); },
  async multiRemove(keys) { for (const k of keys) store.delete(k); },
  async getAllKeys() { return [...store.keys()]; },
  async clear() { store.clear(); },
};

export default AsyncStorage;
