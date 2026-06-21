import { describe, expect, it } from "vitest";
import { calculateMd5Hex } from "./md5Hash";

describe("calculateMd5Hex", () => {
  it("returns the lowercase hex MD5 hash for firmware bytes", () => {
    const bytes = new TextEncoder().encode("abc");

    expect(calculateMd5Hex(bytes)).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});
