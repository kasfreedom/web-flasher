import { describe, expect, it } from "vitest";
import {
  PROVISIONING_COMMAND_PREFIX,
  buildProvisioningCommand,
  parseProvisioningResponseLine,
} from "./provisioningSerial";

describe("provisioningSerial", () => {
  it("builds one UTF-8 command line", () => {
    const command = buildProvisioningCommand('{"type":"provision","deviceId":"kairo-dev-03"}');

    expect(command.text).toBe(
      `${PROVISIONING_COMMAND_PREFIX} {"type":"provision","deviceId":"kairo-dev-03"}\n`,
    );
    expect(new TextDecoder().decode(command.bytes)).toBe(command.text);
  });

  it("parses successful provision_result responses", () => {
    expect(
      parseProvisioningResponseLine('{"type":"provision_result","ok":true,"rebootRequired":true}'),
    ).toEqual({
      matched: true,
      result: {
        ok: true,
        rebootRequired: true,
      },
    });
  });

  it("parses failed provision_result responses", () => {
    expect(
      parseProvisioningResponseLine(
        '{"type":"provision_result","ok":false,"error":"certificate rejected"}',
      ),
    ).toEqual({
      matched: true,
      result: {
        ok: false,
        rebootRequired: false,
        error: "certificate rejected",
      },
    });
  });

  it("ignores logs and unrelated JSON lines", () => {
    expect(parseProvisioningResponseLine("boot log line")).toEqual({ matched: false });
    expect(parseProvisioningResponseLine('{"type":"status","ok":true}')).toEqual({
      matched: false,
    });
  });
});
