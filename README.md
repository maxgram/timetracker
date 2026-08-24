# TimeTracker (Vibecoded concept with bugs)

A modern, cross-platform desktop time tracking app built with **Electron, React, TypeScript, Tailwind CSS** and **SQLite**. Track time per project, group entries by day, filter and export summaries, and bill clients with professional PDF invoices.

![Views](https://img.shields.io/badge/views-6-blue) ![Electron](https://img.shields.io/badge/electron-43-47848f) ![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)


<img width="1584" height="1047" alt="image" src="https://github.com/user-attachments/assets/bcaada9d-ae70-4e9a-82a8-f4e182fedf7e" />


## Features

- **Dashboard** — totals for today / 7 days / 30 days, running timers, weekly per-project breakdown, 7-day bar chart, recent activity
- **Time Tracker** — start/stop per entry with a live ticking `HH:MM:SS` progress; restarting a stopped entry creates a **new entry** with the same name/project (the original record is kept), inline name + project editing, day-grouped history with per-day totals, and full inline editing of old entries (name, project, start/end times)
- **Clients** — full CRUD with contact details, address and tax ID
- **Projects** — CRUD linked to clients, with hourly rates used for billing
- **Summary** — filter by date range / client / project using your **local** day boundaries, per-project breakdown, totals, and **PDF export** with entries grouped by task name + project (with date ranges and summed hours/amounts)
- **Invoices** — professional **PDF invoice export** with your logo, issuer info (company, address, email, phone, tax ID, bank details, currency), line items auto-generated from tracked time (named by task, added manually if you prefer), tax rate, invoice number, and draft/sent/paid status
- **Responsive & touch-friendly** — sidebar on desktop, bottom navigation on narrow windows, ≥44 px touch targets, full content width
- **Dark mode** — light / dark / system, persisted

## Tech stack

| Layer       | Choice                                                       |
| ----------- | ------------------------------------------------------------ |
| Shell       | Electron 43                                                  |
| Build       | electron-vite 5 (Vite 7)                                     |
| UI          | React 19 + TypeScript                                        |
| Styling     | Tailwind CSS 4 (`@tailwindcss/vite`)                         |
| State       | Zustand                                                      |
| Persistence | SQLite via better-sqlite3 (stored in the app userData dir)   |
| PDF         | pdfmake (Roboto fonts embedded, no external downloads)       |
| Icons       | lucide-react                                                 |
| Packaging   | electron-builder (dmg/zip, AppImage/deb, nsis/portable)      |

## Project structure

```
├── build/                      # electron-builder resources (icon.png, entitlements)
├── scripts/
│   └── make-icon.mjs           # regenerates build/icon.png
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts            # window + app lifecycle
│   │   ├── ipc.ts              # all IPC handlers + logo reading
│   │   └── db/
│   │       ├── index.ts        # SQLite open + schema migration
│   │       └── repos/          # clients, projects, entries, invoices, settings, dashboard
│   ├── preload/                # contextBridge → typed window.api
│   ├── shared/                 # types + IPC channel names (shared between processes)
│   └── renderer/src/
│       ├── App.tsx             # view routing + bootstrap
│       ├── components/         # Layout (sidebar/bottom nav) + UI primitives
│       ├── store/              # zustand stores (data + app/settings)
│       ├── lib/                # formatting helpers + pdfmake documents
│       └── views/              # Dashboard, TimeTracker, Clients, Projects, Summary, Invoices
├── .editorconfig               # editor style defaults (2-space indent, LF, UTF-8)
├── .gitignore
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

## Requirements

- **Node.js ≥ 20** (tested on 24) and npm
- Platform build prerequisites (only when packaging):
  - **Linux**: `libfuse2` for AppImage (Ubuntu 22.04+ ships fuse3; install `libfuse2` or run with `--appimage-extract-and-run`)
  - **macOS**: Xcode Command Line Tools; a valid Apple Developer certificate for signed builds
  - **Windows**: nothing extra for NSIS; use a Windows machine or CI for native artifacts

## Development

```bash
npm install        # installs deps; postinstall rebuilds better-sqlite3 for Electron
npm run dev        # launch app with hot reload (renderer + main)
```

`npm run dev` starts electron-vite in watch mode: changes to the renderer are hot-reloaded instantly; changes to the main/preload processes restart the app automatically. Terminal output includes main-process logs (prefixed with the IPC channel name on errors).

> **Note on npm ≥ 11 (`allow-scripts`):** npm may block `electron` and `esbuild` postinstall scripts.
> If `npm run dev` fails with "Electron uninstall" / missing binary, run:
> ```bash
> npm approve-scripts electron esbuild
> ```

## Scripts

| Command            | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `npm run dev`      | Dev mode with HMR                                    |
| `npm run start`    | Preview the production build locally                 |
| `npm run typecheck`| Type-check main + renderer (`tsc --noEmit`)          |
| `npm run build`    | Compile to `out/` (main, preload, renderer)          |
| `npm run dist`     | Build + package for the current OS                   |
| `npm run dist:mac` | Build + package macOS targets (dmg, zip)             |
| `npm run dist:linux` | Build + package Linux targets (AppImage, deb)      |
| `npm run dist:win` | Build + package Windows targets (nsis, portable)     |

Artifacts land in `dist/`.

## Build & package workflow

1. **Type-check first** — `npm run typecheck` (fast, catches type errors before the heavy build).
2. **Build the app** — `npm run build` compiles main, preload and renderer into `out/`. `npm run start` runs that production build locally to verify it.
3. **Package it** — run one of the `dist*` scripts (below) to produce installers in `dist/`.

### The golden rule: build each OS on its own OS

TimeTracker contains a **native module (`better-sqlite3`)**, so the packaged binaries must match the target platform. The safest and officially supported approach is to produce each artifact on its native OS:

- **macOS** → `npm run dist:mac` on a Mac (dmg requires macOS; code signing needs a Developer ID cert)
- **Linux** → `npm run dist:linux` on Ubuntu/Debian (AppImage + deb)
- **Windows** → `npm run dist:win` on Windows (NSIS installer + portable exe)

`npm run postinstall` runs automatically after `npm install` and runs `electron-builder install-app-deps`, which downloads/rebuilds the correct better-sqlite3 binary for the local Electron ABI. If you switch Electron versions or platforms, re-run:

```bash
npm run postinstall
```

### Cross-building (limited)

electron-builder can technically produce **Windows installers on Linux/macOS** (via Wine for some targets) and **Linux packages on macOS/Windows**, but:

- **macOS dmg/zip cannot be built on Linux or Windows** (needs macOS toolchain; unsigned zip builds sometimes work but are not supported).
- Always verify the packaged app actually launches on the target OS before distributing.

### CI: GitHub Actions (recommended)

Build all three platforms automatically from one repo. Every platform rebuilds better-sqlite3 in its own environment, and macOS signing is handled by the built-in code-sign action when secrets are present.

```yaml
# .github/workflows/build.yml
name: Build
on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            script: npm run dist:mac
            artifact: 'dist/*.dmg'
          - os: ubuntu-22.04
            script: npm run dist:linux
            artifact: 'dist/*.AppImage dist/*.deb'
          - os: windows-latest
            script: npm run dist:win
            artifact: 'dist/*.exe'
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: ${{ matrix.script }}
      - uses: actions/upload-artifact@v4
        with:
          name: timetracker-${{ matrix.os }}
          path: ${{ matrix.artifact }}
```

## Data storage

All data lives in a single SQLite database in Electron's `userData` directory:

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/timetracker/timetracker.db` |
| Linux | `~/.config/timetracker/timetracker.db` |
| Windows | `%APPDATA%\timetracker\timetracker.db` |

The database is created and migrated automatically on first launch (WAL mode). Back up that directory to keep your data. The invoice logo is copied to `logo.<ext>` in the same folder.

## Known limitations

- Running timers keep counting only while the app is open; elapsed time is always computed from the stored start timestamp, so it is accurate across restarts, but it does not count background time while the app is closed.
- PDF export uses the embedded Roboto font (no system font dependency).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Error: Electron uninstall` on dev | `npm approve-scripts electron esbuild && node node_modules/electron/install.js` |
| `Error: A native module is compiled against a different Node.js version` | `npm run postinstall` (rebuilds better-sqlite3 for Electron) |
| AppImage won't launch on Ubuntu 22.04+ | `sudo apt install libfuse2`, or run with `--appimage-extract-and-run` |
| Blank window / GPU crash in a VM or container | Launch with `--disable-gpu --no-sandbox` |
| Renderer console errors | Run `npm run dev` and check the terminal; main-process errors are logged with `[channel]` prefixes |
| Stuck migration | Delete `timetracker.db*` from the userData dir (backup first!) and relaunch |

## License

MIT
