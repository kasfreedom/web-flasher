import { describe, expect, it } from "vitest";
import {
  createInitialState,
  reducer,
  selectCanErase,
  selectCanConnect,
  selectCanFlash,
  selectCanProvision,
  selectEraseButtonLabel,
  selectFlashButtonLabel,
  selectProvisionButtonLabel,
} from "./appState";

describe("appState", () => {
  it("starts unsupported when Web Serial is unavailable", () => {
    const state = createInitialState({ serialSupported: false, secureContext: true });

    expect(state.status).toBe("unsupported");
    expect(state.errorCode).toBe("unsupported-browser");
  });

  it("starts unsupported when the context is insecure", () => {
    const state = createInitialState({ serialSupported: true, secureContext: false });

    expect(state.status).toBe("unsupported");
    expect(state.errorCode).toBe("insecure-context");
  });

  it("allows connection from idle", () => {
    const state = createInitialState({ serialSupported: true, secureContext: true });

    expect(selectCanConnect(state)).toBe(true);
  });

  it("allows flashing only when connected with a valid firmware file", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const selected = reducer(connected, {
      type: "firmware-selected",
      fileName: "kairo-demo.bin",
      sizeBytes: 4,
    });

    expect(selectCanFlash(connected)).toBe(false);
    expect(selectCanFlash(selected)).toBe(true);
  });

  it("tracks flashing progress", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const flashing = reducer(connected, { type: "flash-started" });
    const progressed = reducer(flashing, { type: "flash-progress", percentage: 42 });

    expect(progressed.status).toBe("flashing");
    expect(progressed.progressPercentage).toBe(42);
  });

  it("stores failure code and stops flashing", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const failed = reducer(idle, { type: "failed", errorCode: "flash-failed" });

    expect(failed.status).toBe("failed");
    expect(failed.errorCode).toBe("flash-failed");
    expect(selectCanFlash(failed)).toBe(false);
  });

  it("requires reconnecting before flashing again after success", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const selected = reducer(connected, {
      type: "firmware-selected",
      fileName: "kairo-demo.bin",
      sizeBytes: 4,
    });
    const success = reducer(selected, { type: "success" });

    expect(selectCanConnect(success)).toBe(true);
    expect(success.chipName).toBeNull();
    expect(selectCanFlash(success)).toBe(false);
    expect(selectFlashButtonLabel(success)).toBe("Flash again");
  });

  it("allows erasing only after a device is connected and blocks other actions while erasing", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const erasing = reducer(connected, { type: "erase-started" });

    expect(selectCanErase(idle)).toBe(false);
    expect(selectCanErase(connected)).toBe(true);
    expect(selectCanConnect(erasing)).toBe(false);
    expect(selectCanFlash(erasing)).toBe(false);
    expect(selectCanProvision(erasing)).toBe(false);
    expect(selectEraseButtonLabel(erasing)).toBe("Erasing...");
  });

  it("releases the device after erase succeeds and requires reconnect before flashing", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const selected = reducer(connected, {
      type: "firmware-selected",
      fileName: "kairo-demo.bin",
      sizeBytes: 4,
    });
    const erasing = reducer(selected, { type: "erase-started" });
    const erased = reducer(erasing, { type: "erase-success" });

    expect(erased.status).toBe("erased");
    expect(erased.chipName).toBeNull();
    expect(erased.firmwareFlashed).toBe(false);
    expect(selectCanFlash(erased)).toBe(false);
    expect(selectEraseButtonLabel(erased)).toBe("Erase again");
    expect(erased.nextStep).toContain("Reconnect the device");
  });

  it("allows provisioning with a valid bundle even when firmware was not flashed in this session", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const selected = reducer(idle, {
      type: "provisioning-selected",
      fileName: "kairo-dev-03.json",
      sizeBytes: 1024,
      deviceId: "kairo-dev-03",
      thingName: "kairo-dev-03",
      summary: "kairo-dev-03 / kairo-dev-03",
    });

    expect(selectCanProvision(idle)).toBe(false);
    expect(selectCanProvision(selected)).toBe(true);
    expect(selectProvisionButtonLabel(selected)).toBe("Send provisioning");
  });

  it("keeps firmware flash completion after a provisioning failure", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const provisionSelected = reducer(connected, {
      type: "provisioning-selected",
      fileName: "kairo-dev-03.json",
      sizeBytes: 1024,
      deviceId: "kairo-dev-03",
      thingName: "kairo-dev-03",
      summary: "kairo-dev-03 / kairo-dev-03",
    });
    const flashed = reducer(provisionSelected, { type: "success" });
    const failed = reducer(flashed, {
      type: "failed",
      errorCode: "provisioning-timeout",
      errorDetail: "No provision_result response received.",
    });

    expect(failed.firmwareFlashed).toBe(true);
    expect(selectCanProvision(failed)).toBe(true);
    expect(selectProvisionButtonLabel(failed)).toBe("Try provisioning again");
  });

  it("marks successful provisioning as reboot required", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const provisioning = reducer(connected, { type: "provisioning-started" });
    const provisioned = reducer(provisioning, {
      type: "provisioning-success",
      rebootRequired: true,
    });

    expect(provisioned.status).toBe("provisioned");
    expect(provisioned.rebootRequired).toBe(true);
    expect(provisioned.nextStep).toBe("Provisioning finished. Restart or reset the device.");
  });

  it("requires reconnect before retrying after a released flash failure", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const selected = reducer(connected, {
      type: "firmware-selected",
      fileName: "kairo-demo.bin",
      sizeBytes: 4,
    });
    const released = reducer(selected, { type: "device-released" });
    const failed = reducer(released, { type: "failed", errorCode: "flash-failed" });

    expect(selectCanConnect(failed)).toBe(true);
    expect(selectCanFlash(failed)).toBe(false);
    expect(selectFlashButtonLabel(failed)).toBe("Flash");
  });

  it("does not label flash as a retry after a provisioning bundle validation failure", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const selected = reducer(connected, {
      type: "firmware-selected",
      fileName: "kairo-demo.bin",
      sizeBytes: 4,
    });
    const failed = reducer(selected, {
      type: "failed",
      errorCode: "invalid-provisioning-bundle",
      errorDetail: "Provisioning bundle is missing deviceId.",
    });

    expect(selectCanFlash(failed)).toBe(true);
    expect(selectFlashButtonLabel(failed)).toBe("Flash");
  });

  it("allows reconnect after a connection failure before any device is connected", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const failed = reducer(idle, { type: "failed", errorCode: "serial-connection-failed" });

    expect(selectCanConnect(failed)).toBe(true);
    expect(selectCanFlash(failed)).toBe(false);
  });
});
