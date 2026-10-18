export type SecureStoreCompat = {
  getItemAsync?: (key: string) => Promise<string | null>;
  setItemAsync?: (key: string, value: string) => Promise<void>;
  deleteItemAsync?: (key: string) => Promise<void>;
  getValueForKeyAsync?: (key: string) => Promise<string | null>;
  setValueWithKeyAsync?: (key: string, value: string) => Promise<void>;
  deleteValueWithKeyAsync?: (key: string) => Promise<void>;
};

export async function readSecureStoreValue(
  store: SecureStoreCompat,
  key: string,
): Promise<string | null> {
  const read = store.getItemAsync ?? store.getValueForKeyAsync;
  if (typeof read !== "function") return null;

  try {
    const value = await read.call(store, key);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function writeSecureStoreValue(
  store: SecureStoreCompat,
  key: string,
  value: string,
): Promise<void> {
  const write = store.setItemAsync ?? store.setValueWithKeyAsync;
  if (typeof write !== "function") return;

  try {
    await write.call(store, key, value);
  } catch {
    // Ignore storage-layer compatibility failures so the app can still proceed.
  }
}

export async function deleteSecureStoreValue(
  store: SecureStoreCompat,
  key: string,
): Promise<void> {
  const remove = store.deleteItemAsync ?? store.deleteValueWithKeyAsync;
  if (typeof remove !== "function") return;

  try {
    await remove.call(store, key);
  } catch {
    // Ignore storage-layer compatibility failures so the user can leave Club safely.
  }
}
