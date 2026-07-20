export type AppErrorCode =
  | "unsupported-browser"
  | "insecure-context"
  | "missing-firmware"
  | "invalid-firmware-extension"
  | "empty-firmware"
  | "missing-provisioning-bundle"
  | "empty-provisioning-bundle"
  | "invalid-provisioning-json"
  | "invalid-provisioning-bundle"
  | "port-selection-cancelled"
  | "serial-connection-failed"
  | "bootloader-unavailable"
  | "erase-failed"
  | "flash-failed"
  | "provisioning-timeout"
  | "provisioning-failed"
  | "reset-failed"
  | "unknown";

const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  "unsupported-browser":
    "Web Flasher needs Web Serial, which is available in desktop Chrome or Edge. Open this page there to flash without installing developer tools.",
  "insecure-context": "Web Flasher must be opened from a secure page. Use HTTPS or localhost.",
  "missing-firmware": "Choose a firmware .bin file from this computer before flashing.",
  "invalid-firmware-extension": "Choose a merged firmware file with a .bin filename.",
  "empty-firmware": "The selected firmware file is empty. Choose a valid merged .bin file.",
  "missing-provisioning-bundle": "Choose a provisioning JSON bundle from this computer.",
  "empty-provisioning-bundle": "The selected provisioning bundle is empty.",
  "invalid-provisioning-json": "The provisioning bundle must be valid JSON.",
  "invalid-provisioning-bundle":
    "The provisioning bundle is missing required KAIRO runtime fields.",
  "port-selection-cancelled":
    "No device was selected. Click Connect device and choose the ESP32-S3 serial port.",
  "serial-connection-failed":
    "Could not connect to the device. Check the USB cable, reconnect the board, and try again.",
  "bootloader-unavailable":
    "Could not enter the device bootloader. Hold the boot button while connecting, then try again.",
  "erase-failed":
    "Erase failed. Check the USB connection, make sure the device is in flashing mode, and try again.",
  "flash-failed":
    "Flashing failed. Check the USB connection, make sure the device is in flashing mode, and try again.",
  "provisioning-timeout":
    "No provisioning response was received. Restart the device, reconnect the serial port, and try again.",
  "provisioning-failed": "Provisioning failed. Check the bundle and device logs, then try again.",
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

    if (message.includes("erase")) {
      return "erase-failed";
    }

    if (message.includes("serial") || message.includes("port")) {
      return "serial-connection-failed";
    }

    if (message.includes("flash")) {
      return "flash-failed";
    }

    if (message.includes("provisioning timeout")) {
      return "provisioning-timeout";
    }

    if (message.includes("provisioning")) {
      return "provisioning-failed";
    }
  }

  return "unknown";
}
