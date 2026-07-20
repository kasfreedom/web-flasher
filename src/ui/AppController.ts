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
  type AppAction,
  type AppState,
} from "../domain/appState";
import { FLASH_OFFSET } from "../domain/constants";
import { codeFromUnknownError, mapErrorToMessage, type AppErrorCode } from "../domain/errors";
import { readFirmwareFile, validateFirmwareFile, type FirmwareImage } from "../domain/firmwareFile";
import {
  readProvisioningBundleFile,
  type ProvisioningBundle,
} from "../domain/provisioningBundle";
import type { FlasherClient } from "../flasher/FlasherClient";

const PROVISIONING_TIMEOUT_MS = 15000;
const FLASH_STATUS_ERROR_CODES = new Set<AppErrorCode>([
  "empty-firmware",
  "invalid-firmware-extension",
  "missing-firmware",
  "flash-failed",
  "reset-failed",
]);

interface AppControllerOptions {
  root: ParentNode;
  flasher: FlasherClient;
  serialSupported: boolean;
  secureContext: boolean;
}

export class AppController {
  private state: AppState;
  private firmwareImage: FirmwareImage | null = null;
  private provisioningBundle: ProvisioningBundle | null = null;

  constructor(private readonly options: AppControllerOptions) {
    this.state = createInitialState({
      serialSupported: options.serialSupported,
      secureContext: options.secureContext,
    });
  }

  start(): void {
    this.connectButton.addEventListener("click", () => void this.connect());
    this.eraseButton.addEventListener("click", () => void this.erase());
    this.eraseConfirmInput.addEventListener("change", () => this.render());
    this.flashButton.addEventListener("click", () => void this.flash());
    this.provisionButton.addEventListener("click", () => void this.provision());
    this.firmwarePickerButton.addEventListener("click", () => this.firmwareInput.click());
    this.provisioningPickerButton.addEventListener("click", () => this.provisioningInput.click());
    this.firmwareInput.addEventListener("change", () => void this.selectFirmware());
    this.provisioningInput.addEventListener("change", () => void this.selectProvisioningBundle());
    this.clearLogsButton.addEventListener("click", () => {
      this.logOutput.textContent = "";
    });
    this.render();
  }

  private async connect(): Promise<void> {
    this.dispatch({ type: "connecting" });

    try {
      const result = await this.options.flasher.connect((message) => this.appendLog(message));
      this.dispatch({ type: "connected", chipName: result.chipName });
      this.appendLog(`Connected to ${result.chipName}.`);
    } catch (error) {
      this.dispatch({ type: "failed", errorCode: codeFromUnknownError(error) });
    }
  }

  private async selectFirmware(): Promise<void> {
    const file = this.firmwareInput.files?.[0] ?? null;
    const validation = validateFirmwareFile(file);

    if (!validation.ok) {
      this.firmwareImage = null;
      this.dispatch({ type: "failed", errorCode: validation.code });
      return;
    }

    if (!file) {
      this.firmwareImage = null;
      this.dispatch({ type: "failed", errorCode: "missing-firmware" });
      return;
    }

    this.firmwareImage = await readFirmwareFile(file);
    this.dispatch({
      type: "firmware-selected",
      fileName: validation.fileName,
      sizeBytes: validation.sizeBytes,
    });
  }

  private async selectProvisioningBundle(): Promise<void> {
    const file = this.provisioningInput.files?.[0] ?? null;
    const result = await readProvisioningBundleFile(file);

    if (!result.ok) {
      this.provisioningBundle = null;
      this.dispatch({
        type: "failed",
        errorCode: result.code,
        errorDetail: result.message,
      });
      return;
    }

    this.provisioningBundle = result.bundle;
    this.dispatch({
      type: "provisioning-selected",
      fileName: result.bundle.fileName,
      sizeBytes: result.bundle.sizeBytes,
      deviceId: result.bundle.deviceId,
      thingName: result.bundle.thingName,
      summary: result.bundle.summary,
    });
    this.appendLog(`Provisioning bundle selected for ${result.bundle.summary}.`);
  }

  private async flash(): Promise<void> {
    if (!this.firmwareImage) {
      this.dispatch({ type: "failed", errorCode: "missing-firmware" });
      return;
    }

    this.dispatch({ type: "flash-started" });

    try {
      await this.options.flasher.flash({
        data: this.firmwareImage.data,
        offset: FLASH_OFFSET,
        onProgress: (progress) => {
          this.dispatch({ type: "flash-progress", percentage: Math.round(progress.percentage) });
        },
        onLog: (message) => this.appendLog(message),
      });
      await this.options.flasher.reset();
      await this.releaseDeviceConnection();
      this.dispatch({ type: "success" });
      this.appendLog("Flashing finished.");
    } catch (error) {
      await this.releaseDeviceConnection();
      this.dispatch({ type: "failed", errorCode: codeFromUnknownError(error) });
    }
  }

  private async erase(): Promise<void> {
    this.dispatch({ type: "erase-started" });

    try {
      await this.options.flasher.erase({
        onLog: (message) => this.appendLog(message),
      });
      await this.releaseDeviceConnection();
      this.dispatch({ type: "erase-success" });
      this.eraseConfirmInput.checked = false;
      this.render();
    } catch (error) {
      await this.releaseDeviceConnection();
      this.dispatch({ type: "failed", errorCode: codeFromUnknownError(error) });
    }
  }

  private async provision(): Promise<void> {
    if (!this.provisioningBundle) {
      this.dispatch({ type: "failed", errorCode: "missing-provisioning-bundle" });
      return;
    }

    this.dispatch({ type: "provisioning-started" });

    try {
      const result = await this.options.flasher.provision({
        bundleJson: this.provisioningBundle.json,
        timeoutMs: PROVISIONING_TIMEOUT_MS,
        onLog: (message) => this.appendLog(message),
      });

      this.dispatch({ type: "provisioning-success", rebootRequired: result.rebootRequired });
      await this.releaseDeviceConnection();
      this.appendLog("Provisioning finished.");
    } catch (error) {
      const errorCode = codeFromUnknownError(error);
      await this.releaseDeviceConnection();
      this.dispatch({
        type: "failed",
        errorCode,
        errorDetail: error instanceof Error ? redactSensitiveText(error.message) : undefined,
      });
    }
  }

  private dispatch(action: AppAction): void {
    this.state = reducer(this.state, action);
    this.render();
  }

  private appendLog(message: string): void {
    this.dispatch({ type: "log", message: redactSensitiveText(message) });
    this.logOutput.textContent = this.state.logs.join("\n");
  }

  private async releaseDeviceConnection(): Promise<void> {
    try {
      await this.options.flasher.disconnect();
      this.dispatch({ type: "device-released" });
      this.appendLog("Serial connection released. Select the correct port for the next step.");
    } catch {
      this.dispatch({ type: "device-released" });
    }
  }

  private render(): void {
    const browserSupported = this.state.status !== "unsupported";
    const compatibilityMessage = this.state.errorCode
      ? mapErrorToMessage(this.state.errorCode)
      : "";
    this.supportMessage.textContent = "";
    this.unsupportedScreen.hidden = browserSupported;
    this.stepStrip.hidden = !browserSupported;
    this.workspace.hidden = !browserSupported;
    this.logSection.hidden = !browserSupported;
    this.compatibilityMessage.textContent = browserSupported ? "" : compatibilityMessage;

    this.stateLabel.textContent = labelForFirmwarePhaseStatus(this.state);
    const firmwareText = this.state.firmware
      ? `${this.state.firmware.fileName} (${formatBytes(this.state.firmware.sizeBytes)})`
      : "No file selected";
    this.firmwareLabel.textContent = firmwareText;
    this.progressBar.value = this.state.progressPercentage;
    this.progressLabel.textContent = `${this.state.progressPercentage}%`;
    this.errorMessage.textContent =
      this.state.errorDetail ?? (this.state.errorCode ? mapErrorToMessage(this.state.errorCode) : "");
    this.nextStepMessage.textContent = this.state.nextStep ?? "";

    this.browserStatusLabel.textContent = browserSupported ? "Supported" : "Unsupported";
    this.connectStepLabel.textContent = this.state.chipName ? "Connected" : "Not connected";
    this.firmwareStepLabel.textContent = this.state.firmware ? "Selected" : "No file";
    this.flashStepLabel.textContent = labelForFlashStep(this.state);
    this.provisioningStepLabel.textContent = this.state.provisioning ? "Selected" : "No file";
    this.sendProvisioningStepLabel.textContent = labelForProvisioningStep(this.state);
    this.deviceSummary.textContent = this.state.chipName ?? "Not connected";
    this.firmwareSummary.textContent = firmwareText;
    this.offsetSummary.textContent = "0x0";
    this.checksumSummary.textContent = labelForChecksum(this.state);
    this.provisioningSummary.textContent =
      this.state.provisioning?.summary ?? "No bundle selected";
    this.runtimeSummary.textContent = labelForRuntimeSummary(this.state);
    this.privacySummary.textContent = "File stays local";
    this.browserSummary.textContent = browserSupported
      ? "Web Serial supported"
      : "Use desktop Chrome or Edge";

    this.setStatusClass(this.browserStatusLabel, browserSupported ? "success" : "danger");
    this.setStatusClass(this.connectStepLabel, this.state.chipName ? "success" : "muted");
    this.setStatusClass(this.firmwareStepLabel, this.state.firmware ? "success" : "muted");
    this.setStatusClass(this.flashStepLabel, statusToneForFlash(this.state));
    this.setStatusClass(this.provisioningStepLabel, this.state.provisioning ? "success" : "muted");
    this.setStatusClass(this.sendProvisioningStepLabel, statusToneForProvisioning(this.state));

    this.connectButton.disabled = !selectCanConnect(this.state);
    this.eraseButton.textContent = selectEraseButtonLabel(this.state);
    this.eraseButton.disabled = !selectCanErase(this.state) || !this.eraseConfirmInput.checked;
    this.eraseConfirmInput.disabled =
      this.state.status === "unsupported" ||
      this.state.status === "erasing" ||
      this.state.status === "flashing" ||
      this.state.status === "provisioning";
    this.flashButton.textContent = selectFlashButtonLabel(this.state);
    this.flashButton.disabled = !selectCanFlash(this.state);
    this.provisionButton.textContent = selectProvisionButtonLabel(this.state);
    this.provisionButton.disabled = !selectCanProvision(this.state);
    this.firmwareInput.disabled =
      this.state.status === "unsupported" ||
      this.state.status === "flashing" ||
      this.state.status === "provisioning";
    this.firmwarePickerButton.disabled = this.firmwareInput.disabled;
    this.provisioningInput.disabled =
      this.state.status === "unsupported" ||
      this.state.status === "flashing" ||
      this.state.status === "provisioning";
    this.provisioningPickerButton.disabled = this.provisioningInput.disabled;
  }

  private setStatusClass(
    element: HTMLElement,
    tone: "success" | "warning" | "danger" | "muted",
  ): void {
    element.className = `status-pill status-${tone}`;
  }

  private get supportMessage(): HTMLDivElement {
    return this.required<HTMLDivElement>("#supportMessage");
  }

  private get unsupportedScreen(): HTMLElement {
    return this.required<HTMLElement>("#unsupportedScreen");
  }

  private get compatibilityMessage(): HTMLElement {
    return this.required<HTMLElement>("#compatibilityMessage");
  }

  private get stepStrip(): HTMLElement {
    return this.required<HTMLElement>("#stepStrip");
  }

  private get workspace(): HTMLElement {
    return this.required<HTMLElement>("#workspace");
  }

  private get logSection(): HTMLElement {
    return this.required<HTMLElement>("#logSection");
  }

  private get connectButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#connectButton");
  }

  private get eraseButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#eraseButton");
  }

  private get eraseConfirmInput(): HTMLInputElement {
    return this.required<HTMLInputElement>("#eraseConfirmInput");
  }

  private get firmwareInput(): HTMLInputElement {
    return this.required<HTMLInputElement>("#firmwareInput");
  }

  private get firmwarePickerButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#firmwarePickerButton");
  }

  private get provisioningInput(): HTMLInputElement {
    return this.required<HTMLInputElement>("#provisioningInput");
  }

  private get provisioningPickerButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#provisioningPickerButton");
  }

  private get flashButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#flashButton");
  }

  private get provisionButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#provisionButton");
  }

  private get stateLabel(): HTMLElement {
    return this.required<HTMLElement>("#stateLabel");
  }

  private get firmwareLabel(): HTMLElement {
    return this.required<HTMLElement>("#firmwareLabel");
  }

  private get browserStatusLabel(): HTMLElement {
    return this.required<HTMLElement>("#browserStatusLabel");
  }

  private get connectStepLabel(): HTMLElement {
    return this.required<HTMLElement>("#connectStepLabel");
  }

  private get firmwareStepLabel(): HTMLElement {
    return this.required<HTMLElement>("#firmwareStepLabel");
  }

  private get flashStepLabel(): HTMLElement {
    return this.required<HTMLElement>("#flashStepLabel");
  }

  private get provisioningStepLabel(): HTMLElement {
    return this.required<HTMLElement>("#provisioningStepLabel");
  }

  private get sendProvisioningStepLabel(): HTMLElement {
    return this.required<HTMLElement>("#sendProvisioningStepLabel");
  }

  private get deviceSummary(): HTMLElement {
    return this.required<HTMLElement>("#deviceSummary");
  }

  private get firmwareSummary(): HTMLElement {
    return this.required<HTMLElement>("#firmwareSummary");
  }

  private get offsetSummary(): HTMLElement {
    return this.required<HTMLElement>("#offsetSummary");
  }

  private get checksumSummary(): HTMLElement {
    return this.required<HTMLElement>("#checksumSummary");
  }

  private get provisioningSummary(): HTMLElement {
    return this.required<HTMLElement>("#provisioningSummary");
  }

  private get runtimeSummary(): HTMLElement {
    return this.required<HTMLElement>("#runtimeSummary");
  }

  private get privacySummary(): HTMLElement {
    return this.required<HTMLElement>("#privacySummary");
  }

  private get browserSummary(): HTMLElement {
    return this.required<HTMLElement>("#browserSummary");
  }

  private get progressLabel(): HTMLElement {
    return this.required<HTMLElement>("#progressLabel");
  }

  private get progressBar(): HTMLProgressElement {
    return this.required<HTMLProgressElement>("#progressBar");
  }

  private get errorMessage(): HTMLElement {
    return this.required<HTMLElement>("#errorMessage");
  }

  private get nextStepMessage(): HTMLElement {
    return this.required<HTMLElement>("#nextStepMessage");
  }

  private get clearLogsButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#clearLogsButton");
  }

  private get logOutput(): HTMLPreElement {
    return this.required<HTMLPreElement>("#logOutput");
  }

  private required<T extends Element>(selector: string): T {
    const element = this.options.root.querySelector<T>(selector);

    if (!element) {
      throw new Error(`Missing required element: ${selector}`);
    }

    return element;
  }
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} bytes`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function redactSensitiveText(text: string): string {
  return text
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      "[private key redacted]",
    )
    .replace(/("privateKeyPem"\s*:\s*")[^"]*(")/g, '$1[private key redacted]$2');
}

function labelForFlashStep(state: AppState): string {
  switch (state.status) {
    case "flashing":
      return "Writing";
    case "success":
    case "provisioned":
      return state.firmwareFlashed ? "Verified" : "Waiting";
    case "provisioning":
      return state.firmwareFlashed ? "Verified" : "Waiting";
    case "failed":
      return state.firmwareFlashed
        ? "Verified"
        : isFlashStatusError(state.errorCode)
          ? "Failed"
          : selectCanFlash(state)
            ? "Ready"
            : "Waiting";
    default:
      return selectCanFlash(state) ? "Ready" : "Waiting";
  }
}

function labelForChecksum(state: AppState): string {
  switch (state.status) {
    case "flashing":
      return "Verifying";
    case "success":
    case "provisioned":
      return state.firmwareFlashed ? "Verified" : state.firmware ? "Pending" : "Waiting";
    case "provisioning":
      return state.firmwareFlashed ? "Verified" : state.firmware ? "Pending" : "Waiting";
    case "failed":
      return state.firmwareFlashed
        ? "Verified"
        : isFlashStatusError(state.errorCode)
          ? "Not verified"
          : state.firmware
            ? "Pending"
            : "Waiting";
    default:
      return state.firmware ? "Pending" : "Waiting";
  }
}

function labelForProvisioningStep(state: AppState): string {
  switch (state.status) {
    case "provisioning":
      return "Sending";
    case "provisioned":
      return "Done";
    case "failed":
      return state.provisioning ? "Retry" : "Waiting";
    default:
      return selectCanProvision(state) ? "Ready" : "Waiting";
  }
}

function labelForRuntimeSummary(state: AppState): string {
  if (state.status === "provisioned") {
    return state.rebootRequired ? "Reboot required" : "Provisioned";
  }

  if (state.status === "provisioning") {
    return "Provisioning";
  }

  return "Not provisioned";
}

function statusToneForFlash(state: AppState): "success" | "warning" | "danger" | "muted" {
  switch (state.status) {
    case "success":
    case "provisioned":
      return state.firmwareFlashed ? "success" : "muted";
    case "provisioning":
      return state.firmwareFlashed ? "success" : "muted";
    case "failed":
      return state.firmwareFlashed
        ? "success"
        : isFlashStatusError(state.errorCode)
          ? "danger"
          : selectCanFlash(state)
            ? "success"
            : "muted";
    case "flashing":
      return "warning";
    default:
      return selectCanFlash(state) ? "success" : "muted";
  }
}

function statusToneForProvisioning(
  state: AppState,
): "success" | "warning" | "danger" | "muted" {
  switch (state.status) {
    case "provisioned":
      return "success";
    case "provisioning":
      return "warning";
    case "failed":
      return state.provisioning ? "danger" : "muted";
    default:
      return selectCanProvision(state) ? "success" : "muted";
  }
}

function labelForFirmwarePhaseStatus(state: AppState): string {
  switch (state.status) {
    case "unsupported":
      return "Unsupported";
    case "idle":
      return "Idle";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "erasing":
      return "Erasing";
    case "erased":
      return "Erased";
    case "flashing":
      return "Flashing";
    case "provisioning":
    case "provisioned":
    case "success":
      return state.firmwareFlashed ? "Success" : state.chipName ? "Connected" : "Idle";
    case "failed":
      if (state.firmwareFlashed) {
        return "Success";
      }

      if (isFlashStatusError(state.errorCode)) {
        return "Failed";
      }

      return state.chipName ? "Connected" : "Idle";
  }
}

function isFlashStatusError(errorCode: AppErrorCode | null): boolean {
  return errorCode !== null && FLASH_STATUS_ERROR_CODES.has(errorCode);
}
