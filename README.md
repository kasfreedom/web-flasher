# Web Flasher

Web Flasher is a static browser tool for flashing a merged ESP32-S3 firmware `.bin` file over USB and sending a per-device KAIRO runtime provisioning bundle.

[Open Web Flasher](https://kasfreedom.github.io/web-flasher/)

Selected firmware and provisioning files stay on your computer. The browser reads them locally and writes to the device using Web Serial. There is no upload backend.

## Requirements

- Desktop Chrome or Edge
- ESP32-S3 device
- USB cable
- Merged firmware `.bin` file
- Per-device KAIRO provisioning `.json` bundle

You do not need Python, ESP-IDF, PlatformIO, CLion, or a firmware repository clone for the browser flow.

Safari, iPhone, and Firefox are not primary targets for this version because Web Serial support is required.

## Flashing and provisioning

1. Open [Web Flasher](https://kasfreedom.github.io/web-flasher/) in desktop Chrome or Edge.
2. Connect the ESP32-S3 over USB.
3. Click **Connect device**.
4. Select the ESP32-S3 serial port in the browser picker.
5. Choose the merged firmware `.bin` file from this computer.
6. Click **Flash**.
7. Wait for progress to reach 100%.
8. Choose the per-device provisioning `.json` bundle from this computer.
9. Click **Send provisioning**.
10. Select the running KAIRO firmware serial port when the browser asks again.
11. Wait for the device to report success.
12. Restart or reset the device when Web Flasher says reboot is required.

Erase and flash use ESP32 flashing mode. Web Flasher tries to switch the device into flashing mode automatically. If connection fails, hold BOOT while connecting, then try again.

Provisioning uses the running KAIRO firmware, not flashing mode. After erase, flash, or provisioning, Web Flasher releases the serial connection so the next step can select the correct device mode and port.

For KAIRO testers, use the merged KAIRO firmware binary and flash it at `0x0`.

Provisioning sends one USB serial line:

```text
KAIRO_PROVISION <json>
```

The provisioning bundle must set `type` to `provision` and include `deviceId`, `thingName`, AWS IoT endpoints, the audio ingest WebSocket URL, Amazon Root CA 1, the device certificate, and the device private key. Wi-Fi fields are allowed but not required by Web Flasher.

Web Flasher does not log or persist private keys. It only shows safe bundle metadata such as device ID and thing name.

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
