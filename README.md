# flash

👉 **https://flash.konik.ai**

A web-based flashing tool for installing **AGNOS** on **Konik devices**, built on top of **[`qdl.js`](https://github.com/commaai/qdl.js)**.

No native flashing tools required — everything runs directly in your browser.

---

## ✨ Features

- 🌐 **Browser-based flashing** (no installs required)
- 🧠 **Version selector** to flash specific AGNOS releases
- 📦 **Supports Konik A1 and A1M**
- ⚡ **Fast testing mode** (skip system partition)
- 🪟 **Windows-specific flow** with driver guidance
- 🔌 Uses WebUSB via **qdl.js**

---

## 🧩 Supported Devices

| Device     | Supported |
|-----------|-----------|
| **Konik A1**  | ✅ Yes |
| **Konik A1M** | ✅ Yes |

---

## 🚀 Development

### Install dependencies
```bash
bun install
```

### Start the development server
```bash
bun dev
```

Then open:

👉 **http://localhost:5173**

The app supports **hot reloading** — changes appear instantly as you edit.

---

## 🛠 Editing the App

Main entry point:
```text
src/app/index.jsx
```

Modify this file to update the UI or flashing flow.

---

## 🧪 Debugging & Testing

### Helpful Chrome pages
- `chrome://usb-internals/`
- `chrome://device-log/`

### URL Flags

| Flag | Description |
|-----|------------|
| `?fast=1` | Skip flashing the **system partition** (fastest). Ideal for UI and flow testing |
| `?windows=1` | Force **Windows mode** and show Zadig driver instructions |

**Example:**
```text
https://flash.konik.ai/?fast=1
```

---

## 🔐 Browser Requirements

- Chromium-based browser (Chrome, Edge, Brave)
- WebUSB enabled
- USB-C cable with data support

---

## 📚 Credits

- Flashing backend powered by **[`qdl.js`](https://github.com/commaai/qdl.js)**
- Inspired by the Comma.ai flashing ecosystem
