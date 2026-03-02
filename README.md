# Arch R Flasher

> SD card flasher for Arch R. Select console, panel, flash.

Cross-platform desktop app (Windows, Linux, macOS) that writes the Arch R `no-panel` image to an SD card and injects the correct display panel configuration.

## Features

- Select console type (R36S Original or Clone)
- Select display panel (6 original + 12 clone panels)
- Write image to SD card with progress bar
- Post-flash: injects correct DTB, panel.txt, and variant
- Auto-detects removable disks
- Downloads latest image from GitHub Releases

## Requirements

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (18+)
- Tauri CLI: `cargo install tauri-cli`

### Linux

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev
```

### macOS

Xcode Command Line Tools.

### Windows

[WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11).

## Build

```bash
# Development
cargo tauri dev

# Release (generates installer for current platform)
cargo tauri build
```

## Architecture

```
archr-flasher/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs        # Tauri entry point + commands
│   │   ├── panels.rs      # Panel definitions (18 panels, data-driven)
│   │   ├── disk.rs        # Removable disk detection (Linux/macOS/Windows)
│   │   ├── flash.rs       # Image writing + post-flash FAT32 injection
│   │   └── github.rs      # GitHub Releases API
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── index.html          # UI
│   ├── style.css           # Dark theme (Arch R blue #1793D1)
│   └── main.js             # Frontend logic
└── assets/
    └── fonts/
        └── Quantico-Regular.ttf
```

## How It Works

1. User selects image file (`.img` or `.img.xz`)
2. User selects console (Original / Clone) and panel
3. User selects target SD card
4. App writes image to SD card (with xz decompression if needed)
5. App opens FAT32 BOOT partition directly on the block device (no OS mount)
6. Copies selected panel DTB as `kernel.dtb`
7. Writes `panel.txt`, `panel-confirmed`, and `variant`
8. SD card is ready. Insert in R36S and power on.

## License

GPL v3
