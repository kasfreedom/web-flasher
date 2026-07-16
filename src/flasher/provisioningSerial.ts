import type { ProvisionResult } from "./FlasherClient";

export const PROVISIONING_COMMAND_PREFIX = "KAIRO_PROVISION";

export interface ProvisioningCommand {
  text: string;
  bytes: Uint8Array;
}

export type ProvisioningResponseParseResult =
  | { matched: true; result: ProvisionResult }
  | { matched: false };

export function buildProvisioningCommand(bundleJson: string): ProvisioningCommand {
  const text = `${PROVISIONING_COMMAND_PREFIX} ${bundleJson}\n`;

  return {
    text,
    bytes: new TextEncoder().encode(text),
  };
}

export function parseProvisioningResponseLine(line: string): ProvisioningResponseParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(line);
  } catch {
    return { matched: false };
  }

  if (!isRecord(parsed) || parsed.type !== "provision_result" || typeof parsed.ok !== "boolean") {
    return { matched: false };
  }

  if (!parsed.ok) {
    return {
      matched: true,
      result: {
        ok: false,
        rebootRequired: false,
        error: typeof parsed.error === "string" ? parsed.error : "Provisioning failed.",
      },
    };
  }

  return {
    matched: true,
    result: {
      ok: true,
      rebootRequired: parsed.rebootRequired === true,
    },
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
