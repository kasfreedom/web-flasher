import { FIRMWARE_EXTENSION } from "./constants";

export type FirmwareValidationErrorCode =
  | "missing-firmware"
  | "invalid-firmware-extension"
  | "empty-firmware";

export type FirmwareValidationResult =
  | {
      ok: true;
      fileName: string;
      sizeBytes: number;
    }
  | {
      ok: false;
      code: FirmwareValidationErrorCode;
    };

export interface FirmwareImage {
  fileName: string;
  sizeBytes: number;
  data: Uint8Array;
}

export function validateFirmwareFile(file: File | null): FirmwareValidationResult {
  if (!file) {
    return { ok: false, code: "missing-firmware" };
  }

  if (!file.name.toLowerCase().endsWith(FIRMWARE_EXTENSION)) {
    return { ok: false, code: "invalid-firmware-extension" };
  }

  if (file.size === 0) {
    return { ok: false, code: "empty-firmware" };
  }

  return {
    ok: true,
    fileName: file.name,
    sizeBytes: file.size,
  };
}

export async function readFirmwareFile(file: File): Promise<FirmwareImage> {
  const validation = validateFirmwareFile(file);

  if (!validation.ok) {
    throw new Error(validation.code);
  }

  return {
    fileName: validation.fileName,
    sizeBytes: validation.sizeBytes,
    data: new Uint8Array(await file.arrayBuffer()),
  };
}
