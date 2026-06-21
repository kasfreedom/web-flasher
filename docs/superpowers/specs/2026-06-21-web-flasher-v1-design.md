# Web Flasher V1 Design

Date: 2026-06-21

## Summary

Web Flasher V1 is a static browser-based flashing tool for merged ESP32-S3 firmware binaries. A tester opens the site in desktop Chrome or Edge, connects an ESP32-S3 over USB, selects a local `.bin` file from their computer, and flashes it at offset `0x0`.

The app does not upload firmware files to a backend. The selected binary is read locally by browser JavaScript and written to the device over Web Serial.

## Goals

- Let testers flash a merged ESP32-S3 firmware `.bin` without installing Python, ESP-IDF, PlatformIO, CLion, or cloning a firmware repository.
- Keep the app static-hostable with no backend for V1.
- Use a proven existing flashing library instead of implementing the ESP flashing protocol.
- Keep tester-facing wording simple and avoid developer-heavy terminology.
- Preserve the existing Python `flash.py` flow as an advanced fallback in documentation.

## Non-Goals

- No Wi-Fi configuration.
- No KAIRO source repository dependency.
- No hosted firmware catalog in V1.
- No version picker in V1.
- No multi-file flashing in V1.
- No custom backend or firmware upload service.
- No Safari, iPhone, or Firefox support as primary targets.

## Product Name and Positioning

The project name is **Web Flasher**.

V1 should remain open enough for future firmware and board support, but the first workflow is intentionally narrow: flash one merged ESP32-S3 firmware binary selected from the local computer.

KAIRO-specific wording can appear in docs and helper copy, for example:

> For KAIRO testers, choose the merged KAIRO firmware `.bin` and flash it at `0x0`.

The core app should avoid hardcoding KAIRO-specific filenames or release assumptions.

## User Flow

1. Tester opens Web Flasher in desktop Chrome or Edge.
2. App checks whether Web Serial is available.
3. Tester connects the ESP32-S3 over USB.
4. Tester clicks **Connect device**.
5. Browser shows the serial port picker.
6. Tester selects the ESP32-S3 serial port.
7. Tester chooses a local merged firmware `.bin`.
8. Tester clicks **Flash**.
9. App flashes the binary at offset `0x0`.
10. App shows progress and readable logs.
11. App reports success or a clear failure.
12. App attempts to reset the device, or tells the tester to press reset.
13. For KAIRO, tester continues Wi-Fi setup using the device's own AP / QR setup flow after boot.

## Browser and Installation Model

The tester does not install special developer tools. The primary path requires only:

- desktop Chrome or Edge
- USB cable
- ESP32-S3 device
- local merged firmware `.bin`

The app must clearly explain unsupported browsers:

> Web Flasher needs Web Serial, which is available in desktop Chrome and Edge. Open this page there to flash without installing developer tools.

The Python `flash.py` flow is an advanced fallback in documentation, not the main path.

## Technical Approach

Use Vite with TypeScript and no React for V1.

Vite is used only as a development and build tool:

- During development, it provides a local dev server.
- For production, it outputs static files in `dist/`.
- The static output can be hosted on GitHub Pages, Cloudflare Pages, Netlify, or similar static hosting.
- No Node.js server is required in production.

TypeScript is used to keep the flasher boundary, state transitions, and `esptool-js` integration explicit and easier to test. It is not visible to testers.

Use Espressif `esptool-js` for the flashing implementation. The app must not implement the ESP flashing protocol itself.

## Architecture

The app is split into small units with clear responsibilities.

### `FlasherClient`

Interface that defines the browser flashing boundary.

Responsibilities:

- request serial port access
- connect to the device
- flash binary data at a specified offset
- report progress and logs
- reset or disconnect the device

The rest of the app depends on this interface, not directly on `esptool-js`.

### `EsptoolFlasherClient`

Implementation of `FlasherClient` using `esptool-js`.

Responsibilities:

- create the Web Serial transport
- create the `ESPLoader`
- connect and detect the ESP chip
- write the selected binary at offset `0x0`
- forward `esptool-js` logs and progress
- attempt device reset after flashing

### `firmwareFile`

Validates and reads the selected local firmware file.

Responsibilities:

- require a selected file before flashing
- require `.bin` filename extension
- reject empty files
- read the file as a `Uint8Array`
- return file metadata for display, such as name and byte size

It does not upload or persist the file.

### `appState`

Owns state transitions for the UI.

Required states:

- `unsupported`
- `idle`
- `connecting`
- `connected`
- `flashing`
- `success`
- `failed`

State changes must disable invalid actions. For example, **Flash** is disabled while disconnected, while flashing, or when no valid firmware file is selected.

### `ui`

Tester-facing browser interface.

Responsibilities:

- render browser support status
- render connect and flash controls
- render local firmware file picker
- show connection state
- show progress bar
- show readable logs
- show clear next steps after success or failure

## Flashing Defaults

V1 flashes exactly one selected firmware image:

- offset: `0x0`
- erase all: `false` by default
- compression: enabled if supported by `esptool-js`
- reset after flash: attempt hard reset; if that fails, tell the tester to press reset

The app assumes the selected binary is already a merged ESP32-S3 image produced by the firmware build/release flow.

## Error Handling

Errors should be mapped to tester-facing messages.

Required cases:

- unsupported browser
- insecure context if Web Serial is unavailable because the page is not served securely
- no serial port selected
- user cancelled port selection
- serial connection failure
- device not in bootloader/flashing mode
- invalid or missing firmware file
- empty firmware file
- flash failure
- reset failure after successful flash

Logs may include technical detail, but the main error message should tell the tester what to do next.

## Documentation

V1 docs should include:

- what Web Flasher does
- supported browsers
- no-install browser flashing flow
- local file privacy note: the firmware file stays on the tester's computer
- KAIRO tester instructions for merged `.bin` at `0x0`
- note that Wi-Fi setup happens after boot on the device's AP / QR setup flow
- advanced fallback link or section for the existing Python `flash.py` flow

## Testing Strategy

Use TDD for implementation.

Automated tests should cover:

- firmware file validation
- file reading behavior with valid and invalid files
- app state transitions
- user-facing error mapping
- `FlasherClient` behavior through a fake implementation

Manual hardware testing is required for:

- Web Serial port selection in desktop Chrome or Edge
- ESP32-S3 connection
- flashing a merged `.bin` at `0x0`
- progress updates
- success reporting
- reset behavior
- common failure paths such as cancelled port selection and device not in bootloader mode

## Hosting Options After V1 Works

The app should be deployable to any static host.

Recommended options:

- GitHub Pages if the repo is public and simple static hosting is enough.
- Cloudflare Pages if preview deployments, custom domain handling, or future static firmware assets matter.
- S3/R2 static hosting if hosted firmware binaries become central later.

Hosting should be decided after the local V1 is working and tested.

## Future Extensions

Potential post-V1 features:

- hosted official firmware binaries
- firmware version picker
- static firmware manifest
- checksum display and verification
- multiple file/offset flashing
- optional erase flash control
- chip and flash metadata display
- downloadable flashing logs
- stronger KAIRO release integration

These features should not be included in V1.
