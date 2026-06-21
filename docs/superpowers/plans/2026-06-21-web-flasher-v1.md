# Web Flasher V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static browser app that flashes one local merged ESP32-S3 `.bin` file at offset `0x0` using Web Serial and `esptool-js`.

**Architecture:** The app uses Vite + TypeScript without React. Domain modules validate firmware files, map errors, and manage state. The UI talks to a `FlasherClient` interface, with `EsptoolFlasherClient` as the only module that imports `esptool-js`.

**Tech Stack:** Vite, TypeScript, Vitest, jsdom, `esptool-js`, Web Serial API, plain HTML/CSS.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `index.html`: static HTML shell with app controls.
- Create `vite.config.ts`: Vite build config.
- Create `vitest.config.ts`: unit test config using jsdom.
- Create `tsconfig.json`: TypeScript settings.
- Create `src/main.ts`: app bootstrap.
- Create `src/styles.css`: tester-facing layout and states.
- Create `src/domain/constants.ts`: shared constants such as `FLASH_OFFSET`.
- Create `src/domain/firmwareFile.ts`: local `.bin` validation and reading.
- Create `src/domain/firmwareFile.test.ts`: TDD tests for firmware validation and reading.
- Create `src/domain/errors.ts`: typed error codes and tester-facing messages.
- Create `src/domain/errors.test.ts`: TDD tests for error mapping.
- Create `src/domain/appState.ts`: state reducer and selectors.
- Create `src/domain/appState.test.ts`: TDD tests for state transitions.
- Create `src/flasher/FlasherClient.ts`: interface boundary for flashing.
- Create `src/flasher/EsptoolFlasherClient.ts`: `esptool-js` implementation.
- Create `src/ui/AppController.ts`: DOM event handling and orchestration.
- Create `src/ui/AppController.test.ts`: controller tests using a fake `FlasherClient`.
- Create `README.md`: tester and developer instructions.

---

### Task 1: Scaffold Vite TypeScript Project

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json`:

```json
{
  "name": "web-flasher",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

- [ ] **Step 2: Create TypeScript configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create Vite config**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
  },
});
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 5: Create HTML shell**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Web Flasher</title>
  </head>
  <body>
    <main class="app-shell">
      <section class="panel">
        <header class="header">
          <p class="eyebrow">ESP32-S3 firmware installer</p>
          <h1>Web Flasher</h1>
          <p class="summary">
            Select a merged firmware .bin file from this computer and flash it over USB.
          </p>
        </header>

        <div id="supportMessage" class="notice" role="status"></div>

        <section class="controls" aria-label="Flashing controls">
          <button id="connectButton" type="button">Connect device</button>

          <label class="file-picker">
            <span>Firmware .bin</span>
            <input id="firmwareInput" type="file" accept=".bin,application/octet-stream" />
          </label>

          <button id="flashButton" type="button">Flash</button>
        </section>

        <section class="status-grid" aria-label="Status">
          <div>
            <span class="label">State</span>
            <strong id="stateLabel">Idle</strong>
          </div>
          <div>
            <span class="label">Firmware</span>
            <strong id="firmwareLabel">No file selected</strong>
          </div>
        </section>

        <section class="progress-section" aria-label="Flash progress">
          <div class="progress-header">
            <span>Progress</span>
            <span id="progressLabel">0%</span>
          </div>
          <progress id="progressBar" max="100" value="0"></progress>
        </section>

        <section class="message-section" aria-live="polite">
          <p id="errorMessage" class="error-message"></p>
          <p id="nextStepMessage" class="next-step"></p>
        </section>

        <section class="log-section" aria-label="Logs">
          <div class="log-header">
            <h2>Logs</h2>
            <button id="clearLogsButton" type="button">Clear</button>
          </div>
          <pre id="logOutput"></pre>
        </section>
      </section>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create temporary bootstrap**

Create `src/main.ts`:

```ts
import "./styles.css";

const supportMessage = document.querySelector<HTMLDivElement>("#supportMessage");

if (supportMessage) {
  supportMessage.textContent = "Web Flasher is loading.";
}
```

- [ ] **Step 7: Create base styles**

Create `src/styles.css`:

```css
:root {
  color: #17202a;
  background: #f6f7f9;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

button,
input {
  font: inherit;
}

button {
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  padding: 0 16px;
  color: #ffffff;
  background: #176b87;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-shell {
  width: min(960px, calc(100% - 32px));
  margin: 32px auto;
}

.panel {
  display: grid;
  gap: 20px;
  padding: 28px;
  border: 1px solid #d7dde5;
  border-radius: 8px;
  background: #ffffff;
}

.header {
  display: grid;
  gap: 8px;
}

.eyebrow,
.summary,
.label,
.next-step {
  margin: 0;
  color: #5b6573;
}

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 2rem;
}

h2 {
  font-size: 1rem;
}

.notice,
.error-message {
  margin: 0;
  min-height: 24px;
}

.error-message {
  color: #9f1d35;
}

.controls,
.status-grid,
.progress-header,
.log-header {
  display: flex;
  gap: 12px;
  align-items: center;
}

.controls,
.status-grid {
  flex-wrap: wrap;
}

.file-picker {
  display: grid;
  gap: 6px;
}

.status-grid > div {
  min-width: 180px;
}

.progress-section {
  display: grid;
  gap: 8px;
}

.progress-header,
.log-header {
  justify-content: space-between;
}

progress {
  width: 100%;
  height: 16px;
}

#logOutput {
  min-height: 180px;
  max-height: 320px;
  overflow: auto;
  margin: 0;
  padding: 16px;
  border-radius: 6px;
  color: #d8dee9;
  background: #1f2933;
}

@media (max-width: 640px) {
  .app-shell {
    width: min(100% - 20px, 960px);
    margin: 10px auto;
  }

  .panel {
    padding: 18px;
  }

  .controls {
    align-items: stretch;
    flex-direction: column;
  }
}
```

- [ ] **Step 8: Install runtime dependency**

Run:

```bash
npm install esptool-js
```

Expected: `esptool-js` is added to `dependencies`.

- [ ] **Step 9: Install development dependencies**

Run:

```bash
npm install --save-dev typescript vite vitest jsdom @types/w3c-web-serial
```

Expected: `typescript`, `vite`, `vitest`, `jsdom`, and `@types/w3c-web-serial` are added to `devDependencies`; `package-lock.json` is created.

- [ ] **Step 10: Verify scaffold builds**

Run:

```bash
npm run build
```

Expected: Vite creates `dist/` and the command exits with code `0`.

- [ ] **Step 11: Commit scaffold**

```bash
git add package.json package-lock.json index.html vite.config.ts vitest.config.ts tsconfig.json src/main.ts src/styles.css
git commit -m "chore: scaffold static web flasher app"
```

---

### Task 2: Firmware File Validation

**Files:**
- Create: `src/domain/constants.ts`
- Create: `src/domain/firmwareFile.ts`
- Create: `src/domain/firmwareFile.test.ts`

- [ ] **Step 1: Write failing firmware validation tests**

Create `src/domain/firmwareFile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFirmwareFile, validateFirmwareFile } from "./firmwareFile";

function makeFile(name: string, bytes: number[]): File {
  return new File([new Uint8Array(bytes)], name, { type: "application/octet-stream" });
}

describe("validateFirmwareFile", () => {
  it("rejects a missing file", () => {
    const result = validateFirmwareFile(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing-firmware");
    }
  });

  it("rejects a non-bin file", () => {
    const result = validateFirmwareFile(makeFile("firmware.txt", [1, 2, 3]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid-firmware-extension");
    }
  });

  it("rejects an empty bin file", () => {
    const result = validateFirmwareFile(makeFile("firmware.bin", []));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("empty-firmware");
    }
  });

  it("accepts a non-empty bin file and returns metadata", () => {
    const result = validateFirmwareFile(makeFile("kairo-demo.bin", [1, 2, 3]));

    expect(result).toEqual({
      ok: true,
      fileName: "kairo-demo.bin",
      sizeBytes: 3,
    });
  });
});

describe("readFirmwareFile", () => {
  it("reads the file as bytes with metadata", async () => {
    const image = await readFirmwareFile(makeFile("kairo-demo.bin", [0, 1, 255]));

    expect(image.fileName).toBe("kairo-demo.bin");
    expect(image.sizeBytes).toBe(3);
    expect(Array.from(image.data)).toEqual([0, 1, 255]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/domain/firmwareFile.test.ts
```

Expected: FAIL because `src/domain/firmwareFile.ts` does not exist.

- [ ] **Step 3: Add constants**

Create `src/domain/constants.ts`:

```ts
export const FIRMWARE_EXTENSION = ".bin";
export const FLASH_OFFSET = 0x0;
```

- [ ] **Step 4: Implement firmware validation and reading**

Create `src/domain/firmwareFile.ts`:

```ts
import { FIRMWARE_EXTENSION } from "./constants";

export type FirmwareValidationErrorCode =
  | "missing-firmware"
  | "invalid-firmware-extension"
  | "empty-firmware";

export type FirmwareValidationResult =
  | {
      ok: true;
      fileName: string;
      sizeBytes: number;
    }
  | {
      ok: false;
      code: FirmwareValidationErrorCode;
    };

export interface FirmwareImage {
  fileName: string;
  sizeBytes: number;
  data: Uint8Array;
}

export function validateFirmwareFile(file: File | null): FirmwareValidationResult {
  if (!file) {
    return { ok: false, code: "missing-firmware" };
  }

  if (!file.name.toLowerCase().endsWith(FIRMWARE_EXTENSION)) {
    return { ok: false, code: "invalid-firmware-extension" };
  }

  if (file.size === 0) {
    return { ok: false, code: "empty-firmware" };
  }

  return {
    ok: true,
    fileName: file.name,
    sizeBytes: file.size,
  };
}

export async function readFirmwareFile(file: File): Promise<FirmwareImage> {
  const validation = validateFirmwareFile(file);

  if (!validation.ok) {
    throw new Error(validation.code);
  }

  return {
    fileName: validation.fileName,
    sizeBytes: validation.sizeBytes,
    data: new Uint8Array(await file.arrayBuffer()),
  };
}
```

- [ ] **Step 5: Run tests and verify pass**

Run:

```bash
npm test -- src/domain/firmwareFile.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit firmware validation**

```bash
git add src/domain/constants.ts src/domain/firmwareFile.ts src/domain/firmwareFile.test.ts
git commit -m "feat: validate local firmware files"
```

---

### Task 3: Tester-Facing Error Mapping

**Files:**
- Create: `src/domain/errors.ts`
- Create: `src/domain/errors.test.ts`

- [ ] **Step 1: Write failing error mapping tests**

Create `src/domain/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapErrorToMessage } from "./errors";

describe("mapErrorToMessage", () => {
  it("explains unsupported browsers without mentioning Python first", () => {
    expect(mapErrorToMessage("unsupported-browser")).toContain("desktop Chrome or Edge");
    expect(mapErrorToMessage("unsupported-browser")).not.toContain("Python");
  });

  it("explains cancelled port selection", () => {
    expect(mapErrorToMessage("port-selection-cancelled")).toBe(
      "No device was selected. Click Connect device and choose the ESP32-S3 serial port.",
    );
  });

  it("explains bootloader connection failures", () => {
    expect(mapErrorToMessage("bootloader-unavailable")).toContain("bootloader");
  });

  it("maps unknown errors to a useful generic message", () => {
    expect(mapErrorToMessage("unknown")).toBe(
      "Something went wrong while flashing. Check the logs, reconnect the device, and try again.",
    );
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/domain/errors.test.ts
```

Expected: FAIL because `src/domain/errors.ts` does not exist.

- [ ] **Step 3: Implement error mapping**

Create `src/domain/errors.ts`:

```ts
export type AppErrorCode =
  | "unsupported-browser"
  | "insecure-context"
  | "missing-firmware"
  | "invalid-firmware-extension"
  | "empty-firmware"
  | "port-selection-cancelled"
  | "serial-connection-failed"
  | "bootloader-unavailable"
  | "flash-failed"
  | "reset-failed"
  | "unknown";

const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  "unsupported-browser":
    "Web Flasher needs Web Serial, which is available in desktop Chrome and Edge. Open this page there to flash without installing developer tools.",
  "insecure-context":
    "Web Flasher must be opened from a secure page. Use HTTPS or localhost.",
  "missing-firmware": "Choose a firmware .bin file from this computer before flashing.",
  "invalid-firmware-extension": "Choose a merged firmware file with a .bin filename.",
  "empty-firmware": "The selected firmware file is empty. Choose a valid merged .bin file.",
  "port-selection-cancelled":
    "No device was selected. Click Connect device and choose the ESP32-S3 serial port.",
  "serial-connection-failed":
    "Could not connect to the device. Check the USB cable, reconnect the board, and try again.",
  "bootloader-unavailable":
    "Could not enter the device bootloader. Hold the boot button while connecting, then try again.",
  "flash-failed":
    "Flashing failed. Check the USB connection, make sure the device is in flashing mode, and try again.",
  "reset-failed":
    "Flashing finished, but the device did not reset automatically. Press the reset button on the board.",
  unknown:
    "Something went wrong while flashing. Check the logs, reconnect the device, and try again.",
};

export function mapErrorToMessage(code: AppErrorCode): string {
  return ERROR_MESSAGES[code];
}

export function codeFromUnknownError(error: unknown): AppErrorCode {
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "port-selection-cancelled";
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("bootloader") || message.includes("sync")) {
      return "bootloader-unavailable";
    }

    if (message.includes("serial") || message.includes("port")) {
      return "serial-connection-failed";
    }

    if (message.includes("flash")) {
      return "flash-failed";
    }
  }

  return "unknown";
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- src/domain/errors.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit error mapping**

```bash
git add src/domain/errors.ts src/domain/errors.test.ts
git commit -m "feat: add tester-facing error messages"
```

---

### Task 4: App State Reducer

**Files:**
- Create: `src/domain/appState.ts`
- Create: `src/domain/appState.test.ts`

- [ ] **Step 1: Write failing state tests**

Create `src/domain/appState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialState, reducer, selectCanConnect, selectCanFlash } from "./appState";

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
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/domain/appState.test.ts
```

Expected: FAIL because `src/domain/appState.ts` does not exist.

- [ ] **Step 3: Implement reducer and selectors**

Create `src/domain/appState.ts`:

```ts
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
  return state.status === "idle" || state.status === "failed";
}

export function selectCanFlash(state: AppState): boolean {
  return state.status === "connected" && state.firmware !== null;
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- src/domain/appState.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit state reducer**

```bash
git add src/domain/appState.ts src/domain/appState.test.ts
git commit -m "feat: add flasher app state"
```

---

### Task 5: Flasher Interface and `esptool-js` Adapter

**Files:**
- Create: `src/flasher/FlasherClient.ts`
- Create: `src/flasher/EsptoolFlasherClient.ts`

- [ ] **Step 1: Define the interface first**

Create `src/flasher/FlasherClient.ts`:

```ts
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

export interface FlasherClient {
  connect(onLog: (message: string) => void): Promise<{ chipName: string }>;
  flash(input: FlashFirmwareInput): Promise<void>;
  reset(): Promise<void>;
  disconnect(): Promise<void>;
}
```

- [ ] **Step 2: Implement `esptool-js` adapter**

Create `src/flasher/EsptoolFlasherClient.ts`:

```ts
import {
  ESPLoader,
  type FlashOptions,
  type IEspLoaderTerminal,
  Transport,
} from "esptool-js";
import type { FlashFirmwareInput, FlasherClient } from "./FlasherClient";

const DEFAULT_BAUDRATE = 115200;
const DEFAULT_FLASH_MODE = "dio";
const DEFAULT_FLASH_FREQ = "40m";
const DEFAULT_FLASH_SIZE = "keep";

export class EsptoolFlasherClient implements FlasherClient {
  private transport: Transport | null = null;
  private loader: ESPLoader | null = null;

  async connect(onLog: (message: string) => void): Promise<{ chipName: string }> {
    const port = await navigator.serial.requestPort();
    this.transport = new Transport(port, true);

    const terminal: IEspLoaderTerminal = {
      clean: () => undefined,
      writeLine: (data: string) => onLog(data),
      write: (data: string) => onLog(data),
    };

    this.loader = new ESPLoader({
      transport: this.transport,
      baudrate: DEFAULT_BAUDRATE,
      terminal,
      debugLogging: false,
    });

    const chipName = await this.loader.main();
    return { chipName };
  }

  async flash(input: FlashFirmwareInput): Promise<void> {
    if (!this.loader) {
      throw new Error("serial connection is not open");
    }

    const options: FlashOptions = {
      fileArray: [{ data: input.data, address: input.offset }],
      flashMode: DEFAULT_FLASH_MODE,
      flashFreq: DEFAULT_FLASH_FREQ,
      flashSize: DEFAULT_FLASH_SIZE,
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex: number, writtenBytes: number, totalBytes: number) => {
        input.onProgress({
          fileIndex,
          writtenBytes,
          totalBytes,
          percentage: totalBytes === 0 ? 0 : (writtenBytes / totalBytes) * 100,
        });
      },
    };

    input.onLog(`Writing firmware at 0x${input.offset.toString(16)}.`);
    await this.loader.writeFlash(options);
  }

  async reset(): Promise<void> {
    if (!this.loader) {
      return;
    }

    await this.loader.after("hard_reset");
  }

  async disconnect(): Promise<void> {
    await this.transport?.disconnect();
    this.loader = null;
    this.transport = null;
  }
}
```

- [ ] **Step 3: Run typecheck through build**

Run:

```bash
npm run build
```

Expected: PASS. If `esptool-js` type names differ from this plan, inspect the installed package types and adjust only `src/flasher/EsptoolFlasherClient.ts` while keeping the `FlasherClient` interface unchanged unless the interface itself is insufficient.

- [ ] **Step 4: Commit flasher boundary**

```bash
git add src/flasher/FlasherClient.ts src/flasher/EsptoolFlasherClient.ts
git commit -m "feat: add esptool flasher adapter"
```

---

### Task 6: UI Controller with Fake Flasher Tests

**Files:**
- Create: `src/ui/AppController.ts`
- Create: `src/ui/AppController.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write failing controller tests**

Create `src/ui/AppController.test.ts`:

```ts
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

    (document.querySelector("#flashButton") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(flasher.flash).toHaveBeenCalledOnce();
    expect(flasher.flashInput?.offset).toBe(0x0);
    expect(document.querySelector("#progressLabel")?.textContent).toBe("100%");
    expect(document.querySelector("#stateLabel")?.textContent).toBe("Success");
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/ui/AppController.test.ts
```

Expected: FAIL because `src/ui/AppController.ts` does not exist.

- [ ] **Step 3: Implement controller**

Create `src/ui/AppController.ts`:

```ts
import {
  createInitialState,
  reducer,
  selectCanConnect,
  selectCanFlash,
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

  private dispatch(action: Parameters<typeof reducer>[1]): void {
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
    this.firmwareInput.disabled = this.state.status === "unsupported" || this.state.status === "flashing";
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
```

- [ ] **Step 4: Wire controller in main**

Replace `src/main.ts`:

```ts
import "./styles.css";
import { EsptoolFlasherClient } from "./flasher/EsptoolFlasherClient";
import { AppController } from "./ui/AppController";

const serialSupported = "serial" in navigator;
const secureContext = window.isSecureContext;

new AppController({
  root: document,
  flasher: new EsptoolFlasherClient(),
  serialSupported,
  secureContext,
}).start();
```

- [ ] **Step 5: Run controller tests**

Run:

```bash
npm test -- src/ui/AppController.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full automated test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit controller**

```bash
git add src/ui/AppController.ts src/ui/AppController.test.ts src/main.ts
git commit -m "feat: wire browser flashing flow"
```

---

### Task 7: Tester Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:

```md
# Web Flasher

Web Flasher is a static browser tool for flashing a merged ESP32-S3 firmware `.bin` file over USB.

The selected firmware file stays on your computer. The browser reads it locally and writes it to the device using Web Serial. There is no firmware upload backend in V1.

## Requirements

- Desktop Chrome or Edge
- ESP32-S3 device
- USB cable
- Merged firmware `.bin` file

You do not need Python, ESP-IDF, PlatformIO, CLion, or a firmware repository clone for the browser flow.

Safari, iPhone, and Firefox are not primary targets for this version because Web Serial support is required.

## Flashing

1. Open Web Flasher in desktop Chrome or Edge.
2. Connect the ESP32-S3 over USB.
3. Click **Connect device**.
4. Select the ESP32-S3 serial port in the browser picker.
5. Choose the merged firmware `.bin` file from this computer.
6. Click **Flash**.
7. Wait for progress to reach 100%.
8. If the device does not restart automatically, press reset.

For KAIRO testers, use the merged KAIRO firmware binary and flash it at `0x0`. Wi-Fi setup happens after boot using the device AP / QR setup flow.

## Development

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Create a static production build:

```bash
npm run build
```

The production output is written to `dist/` and can be hosted as static files.

## Advanced fallback

If browser flashing is not available on a tester's machine, use the existing Python `flash.py` flow from the firmware documentation.
```

- [ ] **Step 2: Run markdown and build sanity check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit docs**

```bash
git add README.md
git commit -m "docs: add web flasher instructions"
```

---

### Task 8: Final Verification and Manual Test Checklist

**Files:**
- No new files.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` exists.

- [ ] **Step 3: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL such as `http://localhost:5173/`.

- [ ] **Step 4: Manual browser test without hardware**

Open the local URL in desktop Chrome or Edge.

Expected:

- Page loads with the title `Web Flasher`.
- Unsupported-browser message is not shown.
- **Flash** is disabled before connecting.
- Selecting a non-`.bin` file shows a clear error.
- Selecting an empty `.bin` file shows a clear error.
- Logs can be cleared.

- [ ] **Step 5: Manual hardware test with ESP32-S3**

Open the local URL in desktop Chrome or Edge with an ESP32-S3 connected.

Expected:

- **Connect device** opens the serial port picker.
- Cancelling the picker shows the no-device-selected message.
- Choosing the ESP32-S3 port connects or shows a bootloader-mode instruction.
- Selecting a valid merged `.bin` enables **Flash** after connection.
- Flash writes at `0x0`.
- Progress reaches `100%`.
- Success state appears.
- Device resets automatically or the app tells the tester to press reset.

- [ ] **Step 6: Commit verification fixes if needed**

If verification required code or doc changes, commit them:

```bash
git add .
git commit -m "fix: address web flasher verification findings"
```

If no changes were needed, do not create an empty commit.

---

## Plan Self-Review

- Spec coverage: local `.bin` flow, Web Serial support detection, `esptool-js` use, offset `0x0`, no backend, tester logs, progress, error mapping, docs, and manual hardware verification are covered.
- Scope check: hosted binaries, manifests, multi-file offsets, erase controls, and Wi-Fi setup are excluded from implementation tasks.
- Type consistency: `FlasherClient`, `FirmwareImage`, `AppState`, `AppErrorCode`, and `FLASH_OFFSET` are defined before use.
- Test coverage: domain logic and UI orchestration are covered by automated tests; hardware-specific Web Serial behavior is covered by manual verification.
