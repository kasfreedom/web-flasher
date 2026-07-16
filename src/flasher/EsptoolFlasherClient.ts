import {
  ESPLoader,
  type FlashOptions,
  type IEspLoaderTerminal,
  Transport,
} from "esptool-js";
import { calculateMd5Hex } from "../domain/md5Hash";
import type {
  FlashFirmwareInput,
  FlasherClient,
  ProvisionInput,
  ProvisionResult,
} from "./FlasherClient";
import { buildProvisioningCommand, parseProvisioningResponseLine } from "./provisioningSerial";

const DEFAULT_BAUDRATE = 115200;
const DEFAULT_FLASH_MODE = "dio";
const DEFAULT_FLASH_FREQ = "40m";
const DEFAULT_FLASH_SIZE = "keep";
const SERIAL_REOPEN_DELAY_MS = 500;

export class EsptoolFlasherClient implements FlasherClient {
  private selectedPort: SerialPort | null = null;
  private transport: Transport | null = null;
  private loader: ESPLoader | null = null;

  async connect(onLog: (message: string) => void): Promise<{ chipName: string }> {
    await this.releaseEsptoolTransport();
    if (this.selectedPort) {
      await closePortIfOpen(this.selectedPort);
    }

    const port = await navigator.serial.requestPort();
    this.selectedPort = port;
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
      calculateMD5Hash: calculateMd5Hex,
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
    input.onLog("Verifying flash checksum after write.");
    await this.loader.writeFlash(options);
  }

  async provision(input: ProvisionInput): Promise<ProvisionResult> {
    if (!this.selectedPort) {
      throw new Error("serial connection is not open");
    }

    const command = buildProvisioningCommand(input.bundleJson);
    input.onLog(`Sending provisioning command (${command.bytes.length} bytes).`);

    await this.releaseEsptoolTransport();
    await wait(SERIAL_REOPEN_DELAY_MS);

    await openPortIfNeeded(this.selectedPort);

    try {
      await writePlainSerialLine(this.selectedPort, command.bytes);
      const result = await readProvisioningResult(this.selectedPort, input.timeoutMs);
      input.onLog("Provisioning response received.");
      return result;
    } finally {
      await closePortIfOpen(this.selectedPort);
    }
  }

  async reset(): Promise<void> {
    if (!this.loader) {
      return;
    }

    await this.loader.after("hard_reset");
  }

  async disconnect(): Promise<void> {
    await this.releaseEsptoolTransport();
    if (this.selectedPort) {
      await closePortIfOpen(this.selectedPort);
    }
  }

  private async releaseEsptoolTransport(): Promise<void> {
    await this.transport?.disconnect();
    this.loader = null;
    this.transport = null;
  }
}

async function openPortIfNeeded(port: SerialPort): Promise<void> {
  if (port.readable && port.writable) {
    return;
  }

  await port.open({ baudRate: DEFAULT_BAUDRATE });
}

async function closePortIfOpen(port: SerialPort): Promise<void> {
  if (!port.readable && !port.writable) {
    return;
  }

  try {
    await port.close();
  } catch (error) {
    if (error instanceof DOMException && error.name === "InvalidStateError") {
      return;
    }

    throw error;
  }
}

async function writePlainSerialLine(port: SerialPort, data: Uint8Array): Promise<void> {
  if (!port.writable) {
    throw new Error("serial port is not writable");
  }

  const writer = port.writable.getWriter();

  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}

async function readProvisioningResult(
  port: SerialPort,
  timeoutMs: number,
): Promise<ProvisionResult> {
  if (!port.readable) {
    throw new Error("serial port is not readable");
  }

  const reader = port.readable.getReader();
  const decoder = new TextDecoder();
  let bufferedText = "";

  try {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const remainingMs = Math.max(1, deadline - Date.now());
      const readResult = await readWithTimeout(reader, remainingMs);

      if (!readResult) {
        await reader.cancel();
        throw new Error("provisioning timeout: no provision_result response received");
      }

      if (readResult.done) {
        break;
      }

      bufferedText += decoder.decode(readResult.value, { stream: true });
      const lines = bufferedText.split(/\r?\n/);
      bufferedText = lines.pop() ?? "";

      for (const line of lines) {
        const parsed = parseProvisioningResponseLine(line.trim());

        if (parsed.matched) {
          if (!parsed.result.ok) {
            throw new Error(
              `provisioning failed: ${parsed.result.error ?? "unknown device error"}`,
            );
          }

          return parsed.result;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  throw new Error("provisioning timeout: no provision_result response received");
}

async function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
