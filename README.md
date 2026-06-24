# Web Flasher

Web Flasher is a static browser tool for flashing a merged ESP32-S3 firmware `.bin` file over USB.

[Open Web Flasher](https://kasfreedom.github.io/web-flasher/)

The selected firmware file stays on your computer. The browser reads it locally and writes it to the device using Web Serial. There is no firmware upload backend in V1.

## Requirements

- Desktop Chrome or Edge
- ESP32-S3 device
- USB cable
- Merged firmware `.bin` file

You do not need Python, ESP-IDF, PlatformIO, CLion, or a firmware repository clone for the browser flow.

Safari, iPhone, and Firefox are not primary targets for this version because Web Serial support is required.

## Flashing

1. Open [Web Flasher](https://kasfreedom.github.io/web-flasher/) in desktop Chrome or Edge.
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
