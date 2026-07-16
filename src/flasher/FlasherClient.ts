export interface FlashProgress {
  fileIndex: number;
  writtenBytes: number;
  totalBytes: number;
  percentage: number;
}

export interface FlashFirmwareInput {
  data: Uint8Array;
  offset: number;
  onProgress: (progress: FlashProgress) => void;
  onLog: (message: string) => void;
}

export interface ProvisionInput {
  bundleJson: string;
  timeoutMs: number;
  onLog: (message: string) => void;
}

export interface ProvisionResult {
  ok: boolean;
  rebootRequired: boolean;
  error?: string;
}

export interface FlasherClient {
  connect(onLog: (message: string) => void): Promise<{ chipName: string }>;
  flash(input: FlashFirmwareInput): Promise<void>;
  provision(input: ProvisionInput): Promise<ProvisionResult>;
  reset(): Promise<void>;
  disconnect(): Promise<void>;
}
