export type ProvisioningBundleErrorCode =
  | "missing-provisioning-bundle"
  | "empty-provisioning-bundle"
  | "invalid-provisioning-json"
  | "invalid-provisioning-bundle";

export interface ProvisioningBundle {
  fileName: string;
  sizeBytes: number;
  deviceId: string;
  thingName: string;
  summary: string;
  json: string;
}

export type ProvisioningBundleValidationResult =
  | { ok: true; bundle: ProvisioningBundle }
  | { ok: false; code: ProvisioningBundleErrorCode; message: string };

const REQUIRED_STRING_PATHS = [
  "deviceId",
  "thingName",
  "awsIot.endpoint",
  "awsIot.credentialsEndpoint",
  "awsIot.roleAlias",
  "audioIngest.webSocketUrl",
  "certificates.rootCaPem",
  "certificates.deviceCertPem",
  "certificates.privateKeyPem",
] as const;

export function validateProvisioningBundleJson(
  json: string,
  fileMetadata: { fileName?: string; sizeBytes?: number } = {},
): ProvisioningBundleValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      ok: false,
      code: "invalid-provisioning-json",
      message: "Provisioning bundle must be valid JSON.",
    };
  }

  if (!isRecord(parsed)) {
    return invalidBundle("Provisioning bundle must be a JSON object.");
  }

  if (parsed.type !== "provision") {
    return invalidBundle('Provisioning bundle must set type to "provision".');
  }

  for (const path of REQUIRED_STRING_PATHS) {
    if (!nonEmptyString(readPath(parsed, path))) {
      return invalidBundle(`Provisioning bundle is missing ${path}.`);
    }
  }

  const deviceId = String(parsed.deviceId);
  const thingName = String(parsed.thingName);

  return {
    ok: true,
    bundle: {
      fileName: fileMetadata.fileName ?? "provisioning.json",
      sizeBytes: fileMetadata.sizeBytes ?? new TextEncoder().encode(json).byteLength,
      deviceId,
      thingName,
      summary: `${deviceId} / ${thingName}`,
      json: JSON.stringify(parsed),
    },
  };
}

export async function readProvisioningBundleFile(
  file: File | null,
): Promise<ProvisioningBundleValidationResult> {
  if (!file) {
    return {
      ok: false,
      code: "missing-provisioning-bundle",
      message: "Choose a provisioning JSON bundle from this computer.",
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      code: "empty-provisioning-bundle",
      message: "The selected provisioning bundle is empty.",
    };
  }

  return validateProvisioningBundleJson(await file.text(), {
    fileName: file.name,
    sizeBytes: file.size,
  });
}

function invalidBundle(message: string): ProvisioningBundleValidationResult {
  return {
    ok: false,
    code: "invalid-provisioning-bundle",
    message,
  };
}

function readPath(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[key];
  }, input);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function nonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}
