<p align="center">
  <strong>Arch R Flasher</strong><br>
  Flash. Select panel. Play.
</p>

<p align="center">
  <a href="https://github.com/archr-linux/archr-flasher/releases/latest"><img src="https://img.shields.io/github/release/archr-linux/archr-flasher.svg?color=0080FF&label=latest%20version&style=flat-square" alt="Latest Version"></a>
</p>

---

Cross-platform desktop app for flashing [Arch R](https://github.com/archr-linux/Arch-R) onto R36S and clone gaming consoles. Handles image download, SD card writing, and display panel configuration in one step.

## Features

- **Two tabs:** Flash (full image write) and Overlay (change panel on existing SD)
- **24 display panels:** 12 original R36S + 12 clone variants, data-driven selection
- **Customizations:** display rotation, analog stick inversion, headphone detect polarity
- **Image download:** fetches latest release from GitHub with SHA256 verification and caching
- **Compression support:** handles both `.img.gz` and `.img.xz` images
- **Cross-platform:** Windows, Linux, macOS with native privilege escalation
- **In-app updates:** automatic update checking and installation
- **5 languages:** English, Portuguese (BR), Spanish, Chinese, Russian
- **Retry logic:** automatic retry on transient SD card I/O errors

## Download

Get the latest release for your platform from [Releases](https://github.com/archr-linux/archr-flasher/releases).

| Platform | File |
|----------|------|
| Windows | `Arch.R.Flasher_x64-setup.exe` |
| Linux (deb) | `arch-r-flasher_amd64.deb` |
| Linux (AppImage) | `arch-r-flasher_amd64.AppImage` |
| macOS | `Arch.R.Flasher_aarch64.dmg` |

## Usage

### Flash Tab

1. Select console type -- **R36S Original** (12 panels) or **R36S Clone** (12 panels)
2. Select image -- download latest from GitHub or pick a local `.img` / `.img.xz` / `.img.gz` file
3. Select your display panel
4. Optionally adjust customizations (rotation, stick inversion, HP detect)
5. Select target SD card
6. Click **FLASH**

The app decompresses images, writes to SD, and injects the correct panel overlay (DTBO) into the BOOT partition.

### Overlay Tab

Change the display panel on an already-flashed Arch R SD card without reflashing:

1. Insert an Arch R SD card
2. App auto-detects the BOOT partition and shows current panel + settings
3. Select a new panel and/or adjust customizations
4. Click **APPLY**

## Building from Source

### Requirements

- [Rust](https://rustup.rs/) (stable)
- Tauri CLI: `cargo install tauri-cli`

#### Linux

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev
```

#### macOS

Xcode Command Line Tools.

#### Windows

[WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11).

### Build

```bash
# Development
cargo tauri dev

# Release (generates installer for current platform)
cargo tauri build
```

## Architecture

```
archr-flasher/
 src-tauri/
   src/
     main.rs            # Tauri entry point + IPC commands
     panels.rs          # Panel definitions (24 panels, data-driven)
     disk.rs            # Removable disk detection (Linux/macOS/Windows)
     flash.rs           # Image writing + privilege escalation + retry
     github.rs          # GitHub Releases API + image download
     overlay.rs         # SD card panel overlay read/write
     panel_config.rs    # DTBO read/customization (built-in FAT32 reader)
     dtbo_builder.rs    # FDT binary builder (no external tools)
   Cargo.toml
   tauri.conf.json
 src/
   index.html           # UI (two tabs: Flash + Overlay)
   style.css            # Dark theme
   main.js              # Frontend logic (vanilla JS)
   i18n/                # Translations (en, pt-BR, es, zh, ru)
 .github/
   workflows/           # CI/CD
```

### How It Works

**Flash flow:**
1. Download or select `.img.xz` / `.img.gz` image
2. Decompress to app cache directory (streaming, 4MB chunks)
3. Read source panel DTBO from image's FAT32 BOOT partition
4. If customizations are set, build a modified DTBO with injected properties
5. Write image to SD card via platform-specific privileged script (3 retries)
6. Mount boot partition (with retry) and inject DTBO as `overlays/mipi-panel.dtbo`

**Overlay flow:**
1. Detect mounted Arch R BOOT partition
2. Read current `mipi-panel.dtbo` -- identify panel via `panel_description` hash
3. User selects new panel + customizations
4. Build DTBO and write to `overlays/mipi-panel.dtbo`

### Privilege Escalation

| Platform | Method | Notes |
|----------|--------|-------|
| Linux | `pkexec` | No terminal window needed |
| macOS | `osascript` (AppleScript) | Native admin prompt |
| Windows | Admin manifest at startup | No runtime UAC prompt |

### Panel DTBO System

The app includes a built-in FDT binary builder and a minimal FAT32 reader -- no `dtc`, `mtools`, or device-tree-compiler dependency needed. Customizations (rotation, stick inversion, HP detect polarity) are injected as DT properties into the panel overlay, preserving all original hardware nodes (reset-gpios, pinctrl, power supply).

## Supported Panels

### Original R36S (12 panels)

| Panel | Overlay |
|-------|---------|
| Panel 0 | panel0.dtbo |
| Panel 1 | panel1.dtbo |
| Panel 2 | panel2.dtbo |
| Panel 3 | panel3.dtbo |
| Panel 4 | panel4.dtbo |
| Panel 4 V22 | panel4-v22.dtbo |
| Panel 5 | panel5.dtbo |
| Panel 6 | panel6.dtbo |
| R35S Rumble | r35s-rumble.dtbo |
| R36S Plus | r36s-plus.dtbo |
| R46H (1024x768) | r46h.dtbo |
| RGB20S | rgb20s.dtbo |

### Clone R36S (12 panels)

| Panel | Overlay |
|-------|---------|
| Clone 1 (ST7703) | clone_panel_1.dtbo |
| Clone 2 (ST7703) | clone_panel_2.dtbo |
| Clone 3 (NV3051D) | clone_panel_3.dtbo |
| Clone 4 (NV3051D) | clone_panel_4.dtbo |
| Clone 5 (ST7703) | clone_panel_5.dtbo |
| Clone 6 (NV3051D) | clone_panel_6.dtbo |
| Clone 7 (JD9365DA) | clone_panel_7.dtbo |
| Clone 8 G80CA (ST7703) | clone_panel_8.dtbo |
| Clone 9 (NV3051D) | clone_panel_9.dtbo |
| Clone 10 (ST7703) | clone_panel_10.dtbo |
| R36 Max (ST7703 720x720) | r36_max.dtbo |
| RX6S (NV3051D) | rx6s.dtbo |

## Licenses

Copyright (C) 2026-present [Arch R](https://github.com/archr-linux/Arch-R)

Licensed under the terms of the [GNU GPL Version 2](https://choosealicense.com/licenses/gpl-2.0/).

## Credits

Part of the [Arch R](https://github.com/archr-linux/Arch-R) project, built on top of [ROCKNIX](https://github.com/ROCKNIX/distribution).
