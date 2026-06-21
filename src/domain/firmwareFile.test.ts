import { describe, expect, it } from "vitest";
import { readFirmwareFile, validateFirmwareFile } from "./firmwareFile";

function makeFile(name: string, bytes: number[]): File {
  return new File([new Uint8Array(bytes)], name, { type: "application/octet-stream" });
}

describe("validateFirmwareFile", () => {
  it("rejects a missing file", () => {
    const result = validateFirmwareFile(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-firmware");
    }
  });

  it("rejects a non-bin file", () => {
    const result = validateFirmwareFile(makeFile("firmware.txt", [1, 2, 3]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-firmware-extension");
    }
  });

  it("rejects an empty bin file", () => {
    const result = validateFirmwareFile(makeFile("firmware.bin", []));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("empty-firmware");
    }
  });

  it("accepts a non-empty bin file and returns metadata", () => {
    const result = validateFirmwareFile(makeFile("kairo-demo.bin", [1, 2, 3]));

    expect(result).toEqual({
      ok: true,
      fileName: "kairo-demo.bin",
      sizeBytes: 3,
    });
  });
});

describe("readFirmwareFile", () => {
  it("reads the file as bytes with metadata", async () => {
    const image = await readFirmwareFile(makeFile("kairo-demo.bin", [0, 1, 255]));

    expect(image.fileName).toBe("kairo-demo.bin");
    expect(image.sizeBytes).toBe(3);
    expect(Array.from(image.data)).toEqual([0, 1, 255]);
  });
});
