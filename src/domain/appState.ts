import type { AppErrorCode } from "./errors";

export type AppStatus =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "flashing"
  | "provisioning"
  | "provisioned"
  | "success"
  | "failed";

export interface AppState {
  status: AppStatus;
  chipName: string | null;
  firmware: {
    fileName: string;
    sizeBytes: number;
  } | null;
  firmwareFlashed: boolean;
  provisioning: {
    fileName: string;
    sizeBytes: number;
    deviceId: string;
    thingName: string;
    summary: string;
  } | null;
  rebootRequired: boolean | null;
  progressPercentage: number;
  logs: string[];
  errorCode: AppErrorCode | null;
  errorDetail: string | null;
  nextStep: string | null;
}

export type AppAction =
  | { type: "firmware-selected"; fileName: string; sizeBytes: number }
  | { type: "firmware-cleared" }
  | {
      type: "provisioning-selected";
      fileName: string;
      sizeBytes: number;
      deviceId: string;
      thingName: string;
      summary: string;
    }
  | { type: "provisioning-cleared" }
  | { type: "connecting" }
  | { type: "connected"; chipName: string }
  | { type: "flash-started" }
  | { type: "flash-progress"; percentage: number }
  | { type: "provisioning-started" }
  | { type: "provisioning-success"; rebootRequired: boolean }
  | { type: "log"; message: string }
  | { type: "success" }
  | { type: "failed"; errorCode: AppErrorCode; errorDetail?: string }
  | { type: "reset" };

export function createInitialState(input: {
  serialSupported: boolean;
  secureContext: boolean;
}): AppState {
  if (!input.secureContext) {
    return baseState("unsupported", "insecure-context");
  }

  if (!input.serialSupported) {
    return baseState("unsupported", "unsupported-browser");
  }

  return baseState("idle", null);
}

function baseState(status: AppStatus, errorCode: AppErrorCode | null): AppState {
  return {
    status,
    chipName: null,
    firmware: null,
    firmwareFlashed: false,
    provisioning: null,
    rebootRequired: null,
    progressPercentage: 0,
    logs: [],
    errorCode,
    errorDetail: null,
    nextStep: null,
  };
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "firmware-selected":
      return {
        ...state,
        firmware: {
          fileName: action.fileName,
          sizeBytes: action.sizeBytes,
        },
        firmwareFlashed: false,
        errorCode: null,
        errorDetail: null,
      };
    case "firmware-cleared":
      return {
        ...state,
        firmware: null,
        firmwareFlashed: false,
      };
    case "provisioning-selected":
      return {
        ...state,
        provisioning: {
          fileName: action.fileName,
          sizeBytes: action.sizeBytes,
          deviceId: action.deviceId,
          thingName: action.thingName,
          summary: action.summary,
        },
        errorCode: null,
        errorDetail: null,
      };
    case "provisioning-cleared":
      return {
        ...state,
        provisioning: null,
        rebootRequired: null,
      };
    case "connecting":
      return {
        ...state,
        status: "connecting",
        errorCode: null,
        errorDetail: null,
      };
    case "connected":
      return {
        ...state,
        status: "connected",
        chipName: action.chipName,
        errorCode: null,
        errorDetail: null,
      };
    case "flash-started":
      return {
        ...state,
        status: "flashing",
        progressPercentage: 0,
        firmwareFlashed: false,
        rebootRequired: null,
        errorCode: null,
        errorDetail: null,
      };
    case "flash-progress":
      return {
        ...state,
        progressPercentage: Math.max(0, Math.min(100, action.percentage)),
      };
    case "provisioning-started":
      return {
        ...state,
        status: "provisioning",
        errorCode: null,
        errorDetail: null,
        rebootRequired: null,
      };
    case "provisioning-success":
      return {
        ...state,
        status: "provisioned",
        errorCode: null,
        errorDetail: null,
        rebootRequired: action.rebootRequired,
        nextStep: action.rebootRequired
          ? "Provisioning finished. Restart or reset the device."
          : "Provisioning finished.",
      };
    case "log":
      return {
        ...state,
        logs: [...state.logs, action.message],
      };
    case "success":
      return {
        ...state,
        status: "success",
        firmwareFlashed: true,
        progressPercentage: 100,
        errorCode: null,
        errorDetail: null,
        nextStep: "Firmware flashed. Select a provisioning bundle, then send provisioning.",
      };
    case "failed":
      return {
        ...state,
        status: "failed",
        errorCode: action.errorCode,
        errorDetail: action.errorDetail ?? null,
      };
    case "reset":
      return createInitialState({ serialSupported: true, secureContext: true });
  }
}

export function selectCanConnect(state: AppState): boolean {
  return (
    state.status !== "unsupported" &&
    state.status !== "connecting" &&
    state.status !== "flashing" &&
    state.status !== "provisioning"
  );
}

export function selectCanFlash(state: AppState): boolean {
  return (
    state.firmware !== null &&
    state.chipName !== null &&
    state.status !== "flashing" &&
    state.status !== "provisioning" &&
    state.status !== "unsupported" &&
    state.status !== "connecting"
  );
}

export function selectCanProvision(state: AppState): boolean {
  return (
    state.provisioning !== null &&
    state.chipName !== null &&
    state.firmwareFlashed &&
    state.status !== "flashing" &&
    state.status !== "provisioning" &&
    state.status !== "unsupported" &&
    state.status !== "connecting"
  );
}

export function selectFlashButtonLabel(state: AppState): string {
  switch (state.status) {
    case "flashing":
      return "Flashing...";
    case "success":
      return "Flash again";
    case "failed":
      return state.chipName === null ? "Flash" : "Try again";
    default:
      return "Flash";
  }
}

export function selectProvisionButtonLabel(state: AppState): string {
  switch (state.status) {
    case "provisioning":
      return "Sending...";
    case "provisioned":
      return "Send again";
    case "failed":
      return state.firmwareFlashed ? "Try provisioning again" : "Send provisioning";
    default:
      return "Send provisioning";
  }
}
