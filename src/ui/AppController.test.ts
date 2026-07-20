import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppController } from "./AppController";
import type {
  EraseDeviceInput,
  FlashFirmwareInput,
  FlasherClient,
  ProvisionInput,
} from "../flasher/FlasherClient";

class FakeFlasher implements FlasherClient {
  flashInput: FlashFirmwareInput | null = null;
  provisionInput: ProvisionInput | null = null;
  eraseInput: EraseDeviceInput | null = null;
  connect = vi.fn(async () => ({ chipName: "ESP32-S3" }));
  erase = vi.fn(async (input: EraseDeviceInput) => {
    this.eraseInput = input;
    input.onLog("Device flash erased.");
  });
  flash = vi.fn(async (input: FlashFirmwareInput) => {
    this.flashInput = input;
    input.onProgress({ fileIndex: 0, writtenBytes: 5, totalBytes: 10, percentage: 50 });
    input.onProgress({ fileIndex: 0, writtenBytes: 10, totalBytes: 10, percentage: 100 });
  });
  provision = vi.fn(async (input: ProvisionInput) => {
    this.provisionInput = input;
    input.onLog("Provisioning command accepted.");
    return { ok: true, rebootRequired: true };
  });
  reset = vi.fn(async () => undefined);
  disconnect = vi.fn(async () => undefined);
}

const VALID_PROVISIONING_BUNDLE = {
  type: "provision",
  force: true,
  deviceId: "kairo-dev-03",
  thingName: "kairo-dev-03",
  awsIot: {
    endpoint: "a2rcuwgghnpqq6-ats.iot.us-east-1.amazonaws.com",
    credentialsEndpoint: "c2pqczdioiu1hx.credentials.iot.us-east-1.amazonaws.com",
    roleAlias: "kairo-device-role-alias",
  },
  audioIngest: {
    webSocketUrl: "wss://d2mo4d0qgju6vn.cloudfront.net/ingest",
  },
  certificates: {
    rootCaPem: "-----BEGIN CERTIFICATE-----\nroot\n-----END CERTIFICATE-----\n",
    deviceCertPem: "-----BEGIN CERTIFICATE-----\ndevice\n-----END CERTIFICATE-----\n",
    privateKeyPem: "-----BEGIN RSA PRIVATE KEY-----\nprivate\n-----END RSA PRIVATE KEY-----\n",
  },
};

function setupDom(): void {
  document.body.innerHTML = `
    <div id="supportMessage"></div>
    <section id="unsupportedScreen" hidden>
      <p id="compatibilityMessage"></p>
    </section>
    <section id="stepStrip"></section>
    <section id="workspace"></section>
    <section id="logSection"></section>
    <span id="browserStatusLabel"></span>
    <span id="connectStepLabel"></span>
    <span id="firmwareStepLabel"></span>
    <span id="flashStepLabel"></span>
    <span id="provisioningStepLabel"></span>
    <span id="sendProvisioningStepLabel"></span>
    <button id="connectButton" type="button">Connect device</button>
    <input id="eraseConfirmInput" type="checkbox" />
    <button id="eraseButton" type="button">Erase device</button>
    <button id="firmwarePickerButton" type="button">Choose firmware</button>
    <input id="firmwareInput" type="file" />
    <button id="flashButton" type="button">Flash</button>
    <button id="provisioningPickerButton" type="button">Choose bundle</button>
    <input id="provisioningInput" type="file" />
    <button id="provisionButton" type="button">Send provisioning</button>
    <strong id="stateLabel"></strong>
    <strong id="firmwareLabel"></strong>
    <span id="deviceSummary"></span>
    <span id="firmwareSummary"></span>
    <span id="offsetSummary"></span>
    <span id="checksumSummary"></span>
    <span id="provisioningSummary"></span>
    <span id="runtimeSummary"></span>
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

    expect(document.querySelector("#supportMessage")?.textContent).toBe("");
    expect((document.querySelector("#unsupportedScreen") as HTMLElement).hidden).toBe(false);
    expect((document.querySelector("#stepStrip") as HTMLElement).hidden).toBe(true);
    expect((document.querySelector("#workspace") as HTMLElement).hidden).toBe(true);
    expect((document.querySelector("#logSection") as HTMLElement).hidden).toBe(true);
    expect(document.querySelector("#compatibilityMessage")?.textContent).toContain(
      "desktop Chrome or Edge",
    );
    expect((document.querySelector("#connectButton") as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides the unsupported browser screen when Web Serial is available", () => {
    new AppController({
      root: document,
      flasher: new FakeFlasher(),
      serialSupported: true,
      secureContext: true,
    }).start();

    expect((document.querySelector("#unsupportedScreen") as HTMLElement).hidden).toBe(true);
    expect((document.querySelector("#stepStrip") as HTMLElement).hidden).toBe(false);
    expect((document.querySelector("#workspace") as HTMLElement).hidden).toBe(false);
    expect((document.querySelector("#logSection") as HTMLElement).hidden).toBe(false);
  });

  it("opens hidden file inputs from visible picker buttons", () => {
    new AppController({
      root: document,
      flasher: new FakeFlasher(),
      serialSupported: true,
      secureContext: true,
    }).start();

    const firmwareInput = document.querySelector("#firmwareInput") as HTMLInputElement;
    const provisioningInput = document.querySelector("#provisioningInput") as HTMLInputElement;
    const firmwareClick = vi.spyOn(firmwareInput, "click").mockImplementation(() => undefined);
    const provisioningClick = vi
      .spyOn(provisioningInput, "click")
      .mockImplementation(() => undefined);

    (document.querySelector("#firmwarePickerButton") as HTMLButtonElement).click();
    (document.querySelector("#provisioningPickerButton") as HTMLButtonElement).click();

    expect(firmwareClick).toHaveBeenCalledOnce();
    expect(provisioningClick).toHaveBeenCalledOnce();
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

  it("enables erase only after connecting and confirming the danger checkbox", async () => {
    const flasher = new FakeFlasher();
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    const eraseButton = document.querySelector("#eraseButton") as HTMLButtonElement;
    const eraseConfirm = document.querySelector("#eraseConfirmInput") as HTMLInputElement;

    expect(eraseButton.disabled).toBe(true);

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    expect(eraseButton.disabled).toBe(true);

    eraseConfirm.checked = true;
    eraseConfirm.dispatchEvent(new Event("change"));

    expect(eraseButton.disabled).toBe(false);
  });

  it("erases connected device flash after confirmation", async () => {
    const flasher = new FakeFlasher();
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    const eraseConfirm = document.querySelector("#eraseConfirmInput") as HTMLInputElement;
    eraseConfirm.checked = true;
    eraseConfirm.dispatchEvent(new Event("change"));
    (document.querySelector("#eraseButton") as HTMLButtonElement).click();
    await waitForAsyncDomWork();

    expect(flasher.erase).toHaveBeenCalledOnce();
    expect(flasher.disconnect).toHaveBeenCalledOnce();
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Erased");
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("Not connected");
    expect(document.querySelector("#nextStepMessage")?.textContent).toContain("Device flash erased");
    expect(document.querySelector("#nextStepMessage")?.textContent).toContain("Reconnect");
    expect(document.querySelector("#logOutput")?.textContent).toContain("Device flash erased");
    expect(eraseConfirm.checked).toBe(false);
    expect((document.querySelector("#eraseButton") as HTMLButtonElement).disabled).toBe(true);
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
    expect(flasher.disconnect).toHaveBeenCalledOnce();
    expect(flasher.flashInput?.offset).toBe(0x0);
    expect(document.querySelector("#progressLabel")?.textContent).toBe("100%");
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Success");
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("Not connected");
    expect(document.querySelector("#flashStepLabel")?.textContent).toBe("Verified");
    expect(document.querySelector("#checksumSummary")?.textContent).toBe("Verified");
    expect((document.querySelector("#flashButton") as HTMLButtonElement).disabled).toBe(true);
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
    expect(document.querySelector("#provisioningStepLabel")?.textContent).toBe("No file");
    expect(document.querySelector("#sendProvisioningStepLabel")?.textContent).toBe("Waiting");
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("Not connected");
    expect(document.querySelector("#offsetSummary")?.textContent).toBe("0x0");
    expect(document.querySelector("#provisioningSummary")?.textContent).toBe("No bundle selected");
    expect(document.querySelector("#runtimeSummary")?.textContent).toBe("Not provisioned");
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

  it("selects provisioning bundle and renders safe metadata only", async () => {
    new AppController({
      root: document,
      flasher: new FakeFlasher(),
      serialSupported: true,
      secureContext: true,
    }).start();

    const input = document.querySelector("#provisioningInput") as HTMLInputElement;
    setInputFile(
      input,
      new File([JSON.stringify(VALID_PROVISIONING_BUNDLE)], "kairo-dev-03.json", {
        type: "application/json",
      }),
    );
    input.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    expect(document.querySelector("#provisioningStepLabel")?.textContent).toBe("Selected");
    expect(document.querySelector("#provisioningSummary")?.textContent).toBe(
      "kairo-dev-03 / kairo-dev-03",
    );
    expect((document.querySelector("#provisionButton") as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelector("#logOutput")?.textContent).not.toContain("PRIVATE KEY");
  });

  it("keeps firmware flash step neutral when provisioning bundle validation fails before flashing", async () => {
    new AppController({
      root: document,
      flasher: new FakeFlasher(),
      serialSupported: true,
      secureContext: true,
    }).start();

    const firmwareInput = document.querySelector("#firmwareInput") as HTMLInputElement;
    setInputFile(firmwareInput, new File([new Uint8Array([1, 2, 3])], "kairo-demo.bin"));
    firmwareInput.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    const provisioningInput = document.querySelector("#provisioningInput") as HTMLInputElement;
    setInputFile(
      provisioningInput,
      new File([JSON.stringify({ type: "provision" })], "bad-provisioning.json"),
    );
    provisioningInput.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    expect(document.querySelector("#stateLabel")?.textContent).toBe("Idle");
    expect(document.querySelector("#errorMessage")?.textContent).toContain("missing deviceId");
    expect(document.querySelector("#flashStepLabel")?.textContent).toBe("Waiting");
    expect(document.querySelector("#checksumSummary")?.textContent).toBe("Pending");
  });

  it("sends selected provisioning bundle after flashing succeeds", async () => {
    const flasher = new FakeFlasher();
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    const firmwareInput = document.querySelector("#firmwareInput") as HTMLInputElement;
    setInputFile(firmwareInput, new File([new Uint8Array([1, 2, 3])], "kairo-demo.bin"));
    firmwareInput.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    (document.querySelector("#flashButton") as HTMLButtonElement).click();
    await waitForAsyncDomWork();

    const provisioningInput = document.querySelector("#provisioningInput") as HTMLInputElement;
    setInputFile(
      provisioningInput,
      new File([JSON.stringify(VALID_PROVISIONING_BUNDLE, null, 2)], "kairo-dev-03.json"),
    );
    provisioningInput.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    (document.querySelector("#provisionButton") as HTMLButtonElement).click();
    await waitForAsyncDomWork();

    expect(flasher.provision).toHaveBeenCalledOnce();
    expect(flasher.disconnect).toHaveBeenCalledTimes(2);
    expect(flasher.provisionInput?.bundleJson).toBe(JSON.stringify(VALID_PROVISIONING_BUNDLE));
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Success");
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("Not connected");
    expect(document.querySelector("#sendProvisioningStepLabel")?.textContent).toBe("Done");
    expect(document.querySelector("#runtimeSummary")?.textContent).toBe("Reboot required");
    expect(document.querySelector("#nextStepMessage")?.textContent).toContain("Restart or reset");
  });

  it("sends selected provisioning bundle without flashing firmware first", async () => {
    const flasher = new FakeFlasher();
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    const provisioningInput = document.querySelector("#provisioningInput") as HTMLInputElement;
    setInputFile(
      provisioningInput,
      new File([JSON.stringify(VALID_PROVISIONING_BUNDLE, null, 2)], "kairo-dev-03.json"),
    );
    provisioningInput.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();

    const provisionButton = document.querySelector("#provisionButton") as HTMLButtonElement;
    expect(provisionButton.disabled).toBe(false);

    provisionButton.click();
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Idle");
    expect(document.querySelector("#flashStepLabel")?.textContent).toBe("Waiting");
    expect(document.querySelector("#checksumSummary")?.textContent).toBe("Waiting");
    await waitForAsyncDomWork();

    expect(flasher.flash).not.toHaveBeenCalled();
    expect(flasher.provision).toHaveBeenCalledOnce();
    expect(flasher.disconnect).toHaveBeenCalledOnce();
    expect(flasher.provisionInput?.bundleJson).toBe(JSON.stringify(VALID_PROVISIONING_BUNDLE));
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Idle");
    expect(document.querySelector("#flashStepLabel")?.textContent).toBe("Waiting");
    expect(document.querySelector("#checksumSummary")?.textContent).toBe("Waiting");
    expect(document.querySelector("#runtimeSummary")?.textContent).toBe("Reboot required");
  });

  it("redacts private keys from logs and provisioning errors", async () => {
    const flasher = new FakeFlasher();
    flasher.provision.mockImplementationOnce(async (input: ProvisionInput) => {
      input.onLog("privateKeyPem: -----BEGIN RSA PRIVATE KEY----- secret -----END RSA PRIVATE KEY-----");
      throw new Error(
        "provisioning failed: -----BEGIN PRIVATE KEY----- secret -----END PRIVATE KEY-----",
      );
    });
    new AppController({
      root: document,
      flasher,
      serialSupported: true,
      secureContext: true,
    }).start();

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();

    const firmwareInput = document.querySelector("#firmwareInput") as HTMLInputElement;
    setInputFile(firmwareInput, new File([new Uint8Array([1, 2, 3])], "kairo-demo.bin"));
    firmwareInput.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();
    (document.querySelector("#flashButton") as HTMLButtonElement).click();
    await waitForAsyncDomWork();

    const provisioningInput = document.querySelector("#provisioningInput") as HTMLInputElement;
    setInputFile(
      provisioningInput,
      new File([JSON.stringify(VALID_PROVISIONING_BUNDLE)], "kairo-dev-03.json"),
    );
    provisioningInput.dispatchEvent(new Event("change"));
    await waitForAsyncDomWork();
    (document.querySelector("#provisionButton") as HTMLButtonElement).click();
    await waitForAsyncDomWork();

    expect(document.querySelector("#logOutput")?.textContent).not.toContain("secret");
    expect(document.querySelector("#errorMessage")?.textContent).not.toContain("secret");
    expect(document.querySelector("#logOutput")?.textContent).toContain("[private key redacted]");
  });

  it("requires reconnecting before flashing again after success", async () => {
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
    expect(flashButton.disabled).toBe(true);
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("Not connected");

    (document.querySelector("#connectButton") as HTMLButtonElement).click();
    await Promise.resolve();
    expect(flashButton.disabled).toBe(false);

    flashButton.click();
    await waitForAsyncDomWork();

    expect(flasher.flash).toHaveBeenCalledTimes(2);
    expect(flasher.disconnect).toHaveBeenCalledTimes(2);
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
    expect(document.querySelector("#deviceSummary")?.textContent).toBe("Not connected");
    expect(flashButton.textContent).toBe("Flash");
    expect(flashButton.disabled).toBe(true);
    expect((document.querySelector("#connectButton") as HTMLButtonElement).disabled).toBe(false);
  });
});
