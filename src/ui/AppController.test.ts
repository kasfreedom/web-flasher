import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppController } from "./AppController";
import type { FlashFirmwareInput, FlasherClient } from "../flasher/FlasherClient";

class FakeFlasher implements FlasherClient {
  flashInput: FlashFirmwareInput | null = null;
  connect = vi.fn(async () => ({ chipName: "ESP32-S3" }));
  flash = vi.fn(async (input: FlashFirmwareInput) => {
    this.flashInput = input;
    input.onProgress({ fileIndex: 0, writtenBytes: 5, totalBytes: 10, percentage: 50 });
    input.onProgress({ fileIndex: 0, writtenBytes: 10, totalBytes: 10, percentage: 100 });
  });
  reset = vi.fn(async () => undefined);
  disconnect = vi.fn(async () => undefined);
}

function setupDom(): void {
  document.body.innerHTML = `
    <div id="supportMessage"></div>
    <span id="browserStatusLabel"></span>
    <span id="connectStepLabel"></span>
    <span id="firmwareStepLabel"></span>
    <span id="flashStepLabel"></span>
    <button id="connectButton" type="button">Connect device</button>
    <input id="firmwareInput" type="file" />
    <button id="flashButton" type="button">Flash</button>
    <strong id="stateLabel"></strong>
    <strong id="firmwareLabel"></strong>
    <span id="deviceSummary"></span>
    <span id="firmwareSummary"></span>
    <span id="offsetSummary"></span>
    <span id="checksumSummary"></span>
    <span id="privacySummary"></span>
    <span id="browserSummary"></span>
    <span id="progressLabel"></span>
    <progress id="progressBar" max="100" value="0"></progress>
    <p id="errorMessage"></p>
    <p id="nextStepMessage"></p>
    <button id="clearLogsButton" type="button">Clear</button>
    <pre id="logOutput"></pre>
  `;
}

function setInputFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, "files", {
    value: [file],
    configurable: true,
  });
}

async function waitForAsyncDomWork(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("AppController", () => {
  beforeEach(() => {
    setupDom();
  });

  it("shows unsupported browser message when serial is unavailable", () => {
    new AppController({
      root: document,
      flasher: new FakeFlasher(),
      serialSupported: false,
      secureContext: true,
    }).start();

    expect(document.querySelector("#supportMessage")?.textContent).toContain(
      "desktop Chrome or Edge",
    );
    expect((document.querySelector("#connectButton") as HTMLButtonElement).disabled).toBe(true);
  });

  it("connects and renders the detected chip", async () => {
    const flasher = new FakeFlasher();
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    expect(flasher.connect).toHaveBeenCalledOnce();
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Connected");
    expect(document.querySelector("#connectStepLabel")?.textContent).toBe("Connected");
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("ESP32-S3");
  });

  it("selects firmware and flashes at offset zero", async () => {
    const flasher = new FakeFlasher();
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    const input = document.querySelector("#firmwareInput") as HTMLInputElement;
    setInputFile(input, new File([new Uint8Array([1, 2, 3])], "kairo-demo.bin"));
    input.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    (document.querySelector("#flashButton") as HTMLButtonElement).click();
    await waitForAsyncDomWork();

    expect(flasher.flash).toHaveBeenCalledOnce();
    expect(flasher.flashInput?.offset).toBe(0x0);
    expect(document.querySelector("#progressLabel")?.textContent).toBe("100%");
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Success");
    expect(document.querySelector("#flashStepLabel")?.textContent).toBe("Verified");
    expect(document.querySelector("#checksumSummary")?.textContent).toBe("Verified");
  });

  it("renders guided step and session defaults before connecting", () => {
    new AppController({
      root: document,
      flasher: new FakeFlasher(),
      serialSupported: true,
      secureContext: true,
    }).start();

    expect(document.querySelector("#browserStatusLabel")?.textContent).toBe("Supported");
    expect(document.querySelector("#connectStepLabel")?.textContent).toBe("Not connected");
    expect(document.querySelector("#firmwareStepLabel")?.textContent).toBe("No file");
    expect(document.querySelector("#flashStepLabel")?.textContent).toBe("Waiting");
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("Not connected");
    expect(document.querySelector("#offsetSummary")?.textContent).toBe("0x0");
    expect(document.querySelector("#privacySummary")?.textContent).toBe("File stays local");
    expect(document.querySelector("#browserSummary")?.textContent).toBe("Web Serial supported");
  });

  it("renders selected firmware in the guided step and session summary", async () => {
    new AppController({
      root: document,
      flasher: new FakeFlasher(),
      serialSupported: true,
      secureContext: true,
    }).start();

    const input = document.querySelector("#firmwareInput") as HTMLInputElement;
    setInputFile(input, new File([new Uint8Array([1, 2, 3])], "kairo-demo.bin"));
    input.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    expect(document.querySelector("#firmwareStepLabel")?.textContent).toBe("Selected");
    expect(document.querySelector("#firmwareSummary")?.textContent).toBe("kairo-demo.bin (3 bytes)");
  });

  it("changes the flash button to Flash again after success and allows another flash", async () => {
    const flasher = new FakeFlasher();
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    const input = document.querySelector("#firmwareInput") as HTMLInputElement;
    setInputFile(input, new File([new Uint8Array([1, 2, 3])], "kairo-demo.bin"));
    input.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    const flashButton = document.querySelector("#flashButton") as HTMLButtonElement;
    flashButton.click();
    await waitForAsyncDomWork();

    expect(flashButton.textContent).toBe("Flash again");
    expect(flashButton.disabled).toBe(false);

    flashButton.click();
    await waitForAsyncDomWork();

    expect(flasher.flash).toHaveBeenCalledTimes(2);
  });

  it("changes the flash button to Try again after a flash failure", async () => {
    const flasher = new FakeFlasher();
    flasher.flash.mockRejectedValueOnce(new Error("flash failed"));
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    const input = document.querySelector("#firmwareInput") as HTMLInputElement;
    setInputFile(input, new File([new Uint8Array([1, 2, 3])], "kairo-demo.bin"));
    input.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    const flashButton = document.querySelector("#flashButton") as HTMLButtonElement;
    flashButton.click();
    await waitForAsyncDomWork();

    expect(document.querySelector("#stateLabel")?.textContent).toBe("Failed");
    expect(flashButton.textContent).toBe("Try again");
    expect(flashButton.disabled).toBe(false);
    expect((document.querySelector("#connectButton") as HTMLButtonElement).disabled).toBe(true);
  });
});
