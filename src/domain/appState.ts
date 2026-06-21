import type { AppErrorCode } from "./errors";

export type AppStatus =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "flashing"
  | "success"
  | "failed";

export interface AppState {
  status: AppStatus;
  chipName: string | null;
  firmware: {
    fileName: string;
    sizeBytes: number;
  } | null;
  progressPercentage: number;
  logs: string[];
  errorCode: AppErrorCode | null;
  nextStep: string | null;
}

export type AppAction =
  | { type: "firmware-selected"; fileName: string; sizeBytes: number }
  | { type: "firmware-cleared" }
  | { type: "connecting" }
  | { type: "connected"; chipName: string }
  | { type: "flash-started" }
  | { type: "flash-progress"; percentage: number }
  | { type: "log"; message: string }
  | { type: "success" }
  | { type: "failed"; errorCode: AppErrorCode }
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
    progressPercentage: 0,
    logs: [],
    errorCode,
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
        errorCode: null,
      };
    case "firmware-cleared":
      return {
        ...state,
        firmware: null,
      };
    case "connecting":
      return {
        ...state,
        status: "connecting",
        errorCode: null,
      };
    case "connected":
      return {
        ...state,
        status: "connected",
        chipName: action.chipName,
        errorCode: null,
      };
    case "flash-started":
      return {
        ...state,
        status: "flashing",
        progressPercentage: 0,
        errorCode: null,
      };
    case "flash-progress":
      return {
        ...state,
        progressPercentage: Math.max(0, Math.min(100, action.percentage)),
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
        progressPercentage: 100,
        errorCode: null,
        nextStep: "Flashing finished. If the device does not restart, press reset.",
      };
    case "failed":
      return {
        ...state,
        status: "failed",
        errorCode: action.errorCode,
      };
    case "reset":
      return createInitialState({ serialSupported: true, secureContext: true });
  }
}

export function selectCanConnect(state: AppState): boolean {
  return state.status === "idle" || (state.status === "failed" && state.chipName === null);
}

export function selectCanFlash(state: AppState): boolean {
  return (
    state.firmware !== null &&
    state.chipName !== null &&
    (state.status === "connected" || state.status === "success" || state.status === "failed")
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
