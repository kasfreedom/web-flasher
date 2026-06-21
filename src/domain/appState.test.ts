import { describe, expect, it } from "vitest";
import {
  createInitialState,
  reducer,
  selectCanConnect,
  selectCanFlash,
  selectFlashButtonLabel,
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

  it("allows flashing again after success when device and firmware remain selected", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const selected = reducer(connected, {
      type: "firmware-selected",
      fileName: "kairo-demo.bin",
      sizeBytes: 4,
    });
    const success = reducer(selected, { type: "success" });

    expect(selectCanConnect(success)).toBe(false);
    expect(selectCanFlash(success)).toBe(true);
    expect(selectFlashButtonLabel(success)).toBe("Flash again");
  });

  it("allows retry after a flash failure when device and firmware remain selected", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const connected = reducer(idle, { type: "connected", chipName: "ESP32-S3" });
    const selected = reducer(connected, {
      type: "firmware-selected",
      fileName: "kairo-demo.bin",
      sizeBytes: 4,
    });
    const failed = reducer(selected, { type: "failed", errorCode: "flash-failed" });

    expect(selectCanConnect(failed)).toBe(false);
    expect(selectCanFlash(failed)).toBe(true);
    expect(selectFlashButtonLabel(failed)).toBe("Try again");
  });

  it("allows reconnect after a connection failure before any device is connected", () => {
    const idle = createInitialState({ serialSupported: true, secureContext: true });
    const failed = reducer(idle, { type: "failed", errorCode: "serial-connection-failed" });

    expect(selectCanConnect(failed)).toBe(true);
    expect(selectCanFlash(failed)).toBe(false);
  });
});
