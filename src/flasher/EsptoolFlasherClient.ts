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
