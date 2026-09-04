# Fluent Pomofocus

A complete, drift-free recreation of the popular [Pomofocus.io](https://pomofocus.io) web app directly within Obsidian as a native desktop plugin.

Eliminates browser background tab freezing, provides high-fidelity synthesized system audio chimes, native desktop notifications, and supports independent detached floating mini-windows ("Small Window").

## Features

- **Drift-Free Precision Countdown**: Calculates `targetEndTime - Date.now()` on every tick, guaranteeing zero drift even during system sleep or heavy CPU load.
- **Detached Popout Window ("Small Window")**: Detach Pomofocus into an independent floating mini-window while editing your notes in the main workspace.
- **Real Audio Effects & Caching**: Supports official Pomofocus sound profiles: `Wood`, `Bell`, `Bird`, `Digital`, and `Kitchen`. Audio files are cached in vault storage for instant zero-latency playback.
- **Native Theme Following**: Automatically adapts to your active Obsidian theme palette (`--background-secondary`, `--background-primary`, `--interactive-accent`, `--text-normal`).
- **Interactive Task System**: Integrated Pomofocus task list supporting estimation vs actual Pomodoro counts, notes, drag reordering, and auto-checking.

## Commands

- `Open Pomofocus in Sidebar`: Mounts Pomofocus in the right sidebar.
- `Open Pomofocus in Small Window`: Opens Pomofocus in an independent floating mini-window.
- `Start / Pause Pomofocus Timer`: Starts or pauses the active countdown.

## Installation

### From Obsidian Community Plugins
1. In Obsidian, open **Settings** > **Community plugins**.
2. Turn off **Restricted mode**.
3. Click **Browse** and search for **Fluent Pomofocus**.
4. Click **Install**, then **Enable**.

## License

MIT License © 2026 Jeff1024
