# Fluent Pomofocus

A complete, drift-free recreation of the popular [Pomofocus.io](https://pomofocus.io) web app directly within Obsidian as a native desktop plugin.

Eliminates browser background tab freezing, provides high-fidelity synthesized system audio chimes, native desktop notifications, and supports independent detached floating mini-windows ("Small Window").

## Features

- **Drift-Free Precision Countdown**: Calculates `targetEndTime - Date.now()` on every tick, guaranteeing zero drift even during system sleep or heavy CPU load.
- **Floating Modal Window (A1 UI Standard)**: Centered overlay modal with golden ratio widescreen adaptation (`640px` wide) and zero empty space.
- **Detached Popout Window ("Small Window")**: Detach Pomofocus into an independent floating mini-window while editing your notes in the main workspace.
- **Keyboard Ergonomics**: `Space` to start/pause, `Ctrl + Tab` / `Ctrl + Shift + Tab` to cycle timer modes, and `Esc` to close floating window.
- **Real Audio Effects & Dual Sound Profiles**: Supports official Pomofocus sound profiles (`Wood`, `Bell`, `Bird`, `Digital`, `Kitchen`) with separate, independent sound sets for Focus session completion vs. Break completion.
- **Click-to-Focus Notifications**: Clean, concise notifications (`Rest!` on focus completion, `Focus!` on break completion). Clicking the Windows toast brings Obsidian to the foreground and opens the Pomofocus floating modal.
- **Native Theme Following**: Automatically adapts to your active Obsidian theme palette (`--background-secondary`, `--background-primary`, `--interactive-accent`, `--text-normal`).
- **Configurable Task System**: Integrated Pomofocus task list with estimation counts and auto-checking, plus a setting toggle to completely remove the task list for a pure countdown experience.

## Commands

- `Open Pomofocus in Sidebar`: Mounts Pomofocus in the right sidebar.
- `Open Pomofocus in Floating Window`: Opens Pomofocus in an in-app floating modal overlay.
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
