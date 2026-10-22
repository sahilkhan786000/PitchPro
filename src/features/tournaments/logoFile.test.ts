import { describe, expect, it } from "vitest";

import { getLogoFileType } from "./logoFile";

describe("getLogoFileType", () => {
  it.each([
    [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      { mimeType: "image/png", extension: "png" },
    ],
    [
      new Uint8Array([0xff, 0xd8, 0xff]),
      { mimeType: "image/jpeg", extension: "jpg" },
    ],
    [
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      ]),
      { mimeType: "image/webp", extension: "webp" },
    ],
  ])("detects supported image bytes", (bytes, expected) => {
    expect(getLogoFileType(bytes)).toEqual(expected);
  });

  it("rejects unsupported file contents", () => {
    expect(() => getLogoFileType(new Uint8Array([0x74, 0x65, 0x78, 0x74]))).toThrow(
      "Choose a valid PNG, JPEG, or WebP image.",
    );
  });
});
