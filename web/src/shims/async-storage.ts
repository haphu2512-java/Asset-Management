/** AsyncStorage for the browser, backed by localStorage, so the shared store and prefs run unchanged. */
function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return store()?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store()?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store()?.removeItem(key);
  },
  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const key of keys) store()?.removeItem(key);
  },
  async multiGet(keys: readonly string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, store()?.getItem(k) ?? null]);
  },
  async getAllKeys(): Promise<string[]> {
    const s = store();
    return s ? Object.keys(s) : [];
  },
  async clear(): Promise<void> {
    store()?.clear();
  },
};

export default AsyncStorage;
