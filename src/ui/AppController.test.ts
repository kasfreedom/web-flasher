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
    <button id="connectButton" type="button">Connect device</button>
    <input id="firmwareInput" type="file" />
    <button id="flashButton" type="button">Flash</button>
    <strong id="stateLabel"></strong>
    <strong id="firmwareLabel"></strong>
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
  });
});
