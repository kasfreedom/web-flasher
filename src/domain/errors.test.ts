import { describe, expect, it } from "vitest";
import { mapErrorToMessage } from "./errors";

describe("mapErrorToMessage", () => {
  it("explains unsupported browsers without mentioning Python first", () => {
    expect(mapErrorToMessage("unsupported-browser")).toContain("desktop Chrome or Edge");
    expect(mapErrorToMessage("unsupported-browser")).not.toContain("Python");
  });

  it("explains cancelled port selection", () => {
    expect(mapErrorToMessage("port-selection-cancelled")).toBe(
      "No device was selected. Click Connect device and choose the ESP32-S3 serial port.",
    );
  });

  it("explains bootloader connection failures", () => {
    expect(mapErrorToMessage("bootloader-unavailable")).toContain("bootloader");
  });

  it("maps unknown errors to a useful generic message", () => {
    expect(mapErrorToMessage("unknown")).toBe(
      "Something went wrong while flashing. Check the logs, reconnect the device, and try again.",
    );
  });
});
