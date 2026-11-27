# Fluent Pomofocus

Pomodoro timer for Obsidian with wall-clock drift protection, configurable auto-pause countdown, dual focus/break sound alerts, optional task tracking, and synchronized sidebar, popout, and floating modal views.

## Requirements

- Obsidian `minAppVersion` **1.7.2** (`manifest.json`)
- Desktop or mobile (`isDesktopOnly: false`); popout window (`openPopoutLeaf`) and window-focus integration require desktop

## Features

### 1. Timer Engine & Auto-Pause
- **Modes & Cycles**: **Pomodoro** (default 50 min), **Short Break** (default 10 min), and **Long Break** (default 20 min) after every configured round interval (default 3).
- **Wall-Clock Accuracy**: Calculates remaining time from `targetEndTime - Date.now()` on a 200 ms interval so background throttling does not slow down the clock.
- **Auto-Advance**: Optional **Auto Start Breaks** and **Auto Start Pomodoros** transitions between focus and break periods.
- **Auto-Pause Countdown**: On-screen toggle and minute limit (default 30 min, range 1–720 min) that counts down continuously across running periods (`Xm left`), freezes during manual pauses, silences any active alarm, and pauses the timer automatically when reached.

### 2. Audio & Notifications
- **Dual Alarm Sets**: 13 built-in sound presets (`wood`, `bell`, `bird`, `digital`, `kitchen`, `gong`, `chime`, `musicbox`, `glass`, `drop`, `reception`, `dingdong`, `positive`) plus `none`, with independent volume (`0–100%`) and repeat count (`1–10`) for focus vs. break completion.
- **Local Audio Caching & Synth Fallback**: Caches downloaded sound assets inside `<pluginDir>/sounds/` for offline playback and falls back to Web Audio synthesis if audio decoding is unavailable.
- **Non-Intrusive Alerts**: Displays an in-app `Notice` (6 s) paired with a silent native `Notification` on period completion; clicking focuses the window and opens the timer modal. Auto-pause stops active sound and posts a quiet in-app `Notice` without triggering a system toast.

### 3. Tasks, Themes & Views
- **Synchronized Surfaces**: Shares one `TimerService` and `SoundService` across the right sidebar view, popout mini-window (`480×720`), and floating modal.
- **Built-In Task List**: Optional task list tracking actual vs. estimated pomodoros, active task increment on pomodoro completion, auto-completion checks, and completed-to-bottom sorting.
- **Visual Themes**: Supports native Obsidian theme variables as well as `teal`, `green`, and `blue` color modes with optional running dark mode.

## Installation

1. **Community Plugins**: Search for **Fluent Pomofocus** in Obsidian Settings -> Community plugins -> Browse, install, and enable.
2. **Manual / GitHub Release**: Download `manifest.json`, `main.js`, and `styles.css` from the latest release into `<vault>/.obsidian/plugins/fluent-pomofocus/`, then enable **Fluent Pomofocus**.

## Commands

| Command ID | Palette Name | Description |
| :--- | :--- | :--- |
| `open-sidebar` | Open Pomofocus in Sidebar | Opens or reveals the right sidebar timer view |
| `open-small-window` | Open Pomofocus in Small Window | Opens the timer in a `480×720` popout leaf (falls back to sidebar) |
| `open-floating-modal` | Open Pomofocus in Floating Window | Opens the floating modal overlay |
| `toggle-timer` | Start / Pause Pomofocus Timer | Starts or pauses the active countdown |
| `reload-settings` | Reload Pomofocus Settings from Disk | Reloads persisted JSON settings from disk and refreshes views |

## Configuration

| Setting | Default | Description |
| :--- | :--- | :--- |
| `pomoTime` / `shortBreakTime` / `longBreakTime` | `50` / `10` / `20` | Focus, short break, and long break durations in minutes |
| `longBreakInterval` | `3` | Completed pomodoros before triggering a long break |
| `autoStartBreaks` / `autoStartPomodoros` | `true` / `true` | Automatically start the next period on natural completion |
| `autoPauseEnabled` / `autoPauseMinutes` | `false` / `30` | Automatically pause the running loop after N elapsed minutes (1–720) |
| `enableTasks` / `autoCheckTasks` / `checkToBottom` | `true` / `false` / `true` | Show tasks, auto-complete at estimate, and sort completed tasks downward |
| `focusAlarmSound` / `breakAlarmSound` | `"wood"` / `"bell"` | Separate alarm sounds, volume (`80`), and repeat count (`2`) |
| `colorTheme` / `darkModeWhenRunning` | `"obsidian"` / `false` | Color preset or native Obsidian theme styling |
| `customStoragePath` | `""` | Optional vault-relative JSON path; defaults to `.obsidian/fluent-pomofocus.json` outside the plugin folder so plugin updates preserve tasks and settings |

## Development

```bash
npm install
npx svelte-check --fail-on-warnings false
npm run build
```

Entry point: `src/main.ts` (built with `esbuild.config.mjs` to `main.js`, copying CSS output to `styles.css`).

## License

MIT License — Copyright (c) 2026 Jeff1024. See [LICENSE](./LICENSE).
