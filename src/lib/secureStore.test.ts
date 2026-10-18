import { describe, expect, it } from "vitest";

import {
  deleteSecureStoreValue,
  readSecureStoreValue,
  writeSecureStoreValue,
} from "./secureStore";

describe("secure store compatibility", () => {
  it("falls back to legacy secure-store APIs when needed", async () => {
    const record: Record<string, string> = {};
    const legacyStore = {
      getItemAsync: async (key: string) => record[key] ?? null,
      setItemAsync: async (key: string, value: string) => {
        record[key] = value;
      },
      deleteValueWithKeyAsync: async (key: string) => {
        delete record[key];
      },
    };

    await writeSecureStoreValue(legacyStore as any, "demo", "hello");
    await expect(
      readSecureStoreValue(legacyStore as any, "demo"),
    ).resolves.toBe("hello");
    await deleteSecureStoreValue(legacyStore as any, "demo");
    await expect(
      readSecureStoreValue(legacyStore as any, "demo"),
    ).resolves.toBe(null);
  });
});
