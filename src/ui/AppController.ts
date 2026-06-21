import {
  createInitialState,
  reducer,
  selectCanConnect,
  selectCanFlash,
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
    this.supportMessage.textContent =
      this.state.status === "unsupported" && this.state.errorCode
        ? mapErrorToMessage(this.state.errorCode)
        : "Ready. Connect the device, choose a firmware .bin, then flash.";

    this.stateLabel.textContent = labelForStatus(this.state.status);
    this.firmwareLabel.textContent = this.state.firmware
      ? `${this.state.firmware.fileName} (${this.state.firmware.sizeBytes} bytes)`
      : "No file selected";
    this.progressBar.value = this.state.progressPercentage;
    this.progressLabel.textContent = `${this.state.progressPercentage}%`;
    this.errorMessage.textContent = this.state.errorCode
      ? mapErrorToMessage(this.state.errorCode)
      : "";
    this.nextStepMessage.textContent = this.state.nextStep ?? "";

    this.connectButton.disabled = !selectCanConnect(this.state);
    this.flashButton.disabled = !selectCanFlash(this.state);
    this.firmwareInput.disabled =
      this.state.status === "unsupported" || this.state.status === "flashing";
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
