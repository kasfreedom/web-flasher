import {
  createInitialState,
  reducer,
  selectCanConnect,
  selectCanFlash,
  selectFlashButtonLabel,
  type AppAction,
  type AppState,
} from "../domain/appState";
import { FLASH_OFFSET } from "../domain/constants";
import { codeFromUnknownError, mapErrorToMessage } from "../domain/errors";
import { readFirmwareFile, validateFirmwareFile, type FirmwareImage } from "../domain/firmwareFile";
import type { FlasherClient } from "../flasher/FlasherClient";

interface AppControllerOptions {
  root: ParentNode;
  flasher: FlasherClient;
  serialSupported: boolean;
  secureContext: boolean;
}

export class AppController {
  private state: AppState;
  private firmwareImage: FirmwareImage | null = null;

  constructor(private readonly options: AppControllerOptions) {
    this.state = createInitialState({
      serialSupported: options.serialSupported,
      secureContext: options.secureContext,
    });
  }

  start(): void {
    this.connectButton.addEventListener("click", () => void this.connect());
    this.flashButton.addEventListener("click", () => void this.flash());
    this.firmwareInput.addEventListener("change", () => void this.selectFirmware());
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
      this.dispatch({ type: "success" });
      this.appendLog("Flashing finished.");
    } catch (error) {
      this.dispatch({ type: "failed", errorCode: codeFromUnknownError(error) });
    }
  }

  private dispatch(action: AppAction): void {
    this.state = reducer(this.state, action);
    this.render();
  }

  private appendLog(message: string): void {
    this.dispatch({ type: "log", message });
    this.logOutput.textContent = this.state.logs.join("\n");
  }

  private render(): void {
    const browserSupported = this.state.status !== "unsupported";
    this.supportMessage.textContent =
      this.state.status === "unsupported" && this.state.errorCode
        ? mapErrorToMessage(this.state.errorCode)
        : "Web Serial is supported";

    this.stateLabel.textContent = labelForStatus(this.state.status);
    const firmwareText = this.state.firmware
      ? `${this.state.firmware.fileName} (${formatBytes(this.state.firmware.sizeBytes)})`
      : "No file selected";
    this.firmwareLabel.textContent = firmwareText;
    this.progressBar.value = this.state.progressPercentage;
    this.progressLabel.textContent = `${this.state.progressPercentage}%`;
    this.errorMessage.textContent = this.state.errorCode
      ? mapErrorToMessage(this.state.errorCode)
      : "";
    this.nextStepMessage.textContent = this.state.nextStep ?? "";

    this.browserStatusLabel.textContent = browserSupported ? "Supported" : "Unsupported";
    this.connectStepLabel.textContent = this.state.chipName ? "Connected" : "Not connected";
    this.firmwareStepLabel.textContent = this.state.firmware ? "Selected" : "No file";
    this.flashStepLabel.textContent = labelForFlashStep(this.state);
    this.deviceSummary.textContent = this.state.chipName ?? "Not connected";
    this.firmwareSummary.textContent = firmwareText;
    this.offsetSummary.textContent = "0x0";
    this.checksumSummary.textContent = labelForChecksum(this.state);
    this.privacySummary.textContent = "File stays local";
    this.browserSummary.textContent = browserSupported
      ? "Web Serial supported"
      : "Use desktop Chrome or Edge";

    this.setStatusClass(this.browserStatusLabel, browserSupported ? "success" : "danger");
    this.setStatusClass(this.connectStepLabel, this.state.chipName ? "success" : "muted");
    this.setStatusClass(this.firmwareStepLabel, this.state.firmware ? "success" : "muted");
    this.setStatusClass(this.flashStepLabel, statusToneForFlash(this.state));

    this.connectButton.disabled = !selectCanConnect(this.state);
    this.flashButton.textContent = selectFlashButtonLabel(this.state);
    this.flashButton.disabled = !selectCanFlash(this.state);
    this.firmwareInput.disabled =
      this.state.status === "unsupported" || this.state.status === "flashing";
  }

  private setStatusClass(element: HTMLElement, tone: "success" | "warning" | "danger" | "muted"): void {
    element.className = `status-pill status-${tone}`;
  }

  private get supportMessage(): HTMLDivElement {
    return this.required<HTMLDivElement>("#supportMessage");
  }

  private get connectButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#connectButton");
  }

  private get firmwareInput(): HTMLInputElement {
    return this.required<HTMLInputElement>("#firmwareInput");
  }

  private get flashButton(): HTMLButtonElement {
    return this.required<HTMLButtonElement>("#flashButton");
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

function labelForFlashStep(state: AppState): string {
  switch (state.status) {
    case "flashing":
      return "Writing";
    case "success":
      return "Verified";
    case "failed":
      return "Failed";
    default:
      return selectCanFlash(state) ? "Ready" : "Waiting";
  }
}

function labelForChecksum(state: AppState): string {
  switch (state.status) {
    case "flashing":
      return "Verifying";
    case "success":
      return "Verified";
    case "failed":
      return "Not verified";
    default:
      return state.firmware ? "Pending" : "Waiting";
  }
}

function statusToneForFlash(state: AppState): "success" | "warning" | "danger" | "muted" {
  switch (state.status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "flashing":
      return "warning";
    default:
      return selectCanFlash(state) ? "success" : "muted";
  }
}

function labelForStatus(status: AppState["status"]): string {
  switch (status) {
    case "unsupported":
      return "Unsupported";
    case "idle":
      return "Idle";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "flashing":
      return "Flashing";
    case "success":
      return "Success";
    case "failed":
      return "Failed";
  }
}
