# Fluent Pomofocus

Obsidian plugin that recreates [Pomofocus](https://pomofocus.io) inside the vault: drift-free countdown, dual focus/break alarms, system + in-app notices, optional task list, and three surfaces (sidebar, popout leaf, floating modal).

Architecture map: [fluent-pomofocus_Architecture.md](./fluent-pomofocus_Architecture.md).

## Requirements

- Obsidian `minAppVersion` **1.7.2** (`manifest.json`)
- Desktop or mobile (`isDesktopOnly: false`); popout leaf and Electron window-focus need desktop
- Node 18+ only if you build from source

## Install (release)

1. Copy the plugin folder into `<vault>/.obsidian/plugins/fluent-pomofocus/`.
2. Required files: `manifest.json`, `main.js`, `styles.css`. Optional: `sounds/*.mp3` (otherwise first play fetches and caches them).
3. Enable **Fluent Pomofocus** in Community Plugins.

## Build from source

```bash
npm install
npm run build    # esbuild production → main.js, copies main.css → styles.css
npm run dev      # watch bundle
```

Entry: `src/main.ts`. Bundler: `esbuild.config.mjs` (`esbuild-svelte`, CSS injected into JS; `src/styles.css` also copied to `styles.css` for Obsidian).

## Open the timer

| Surface | How |
|---|---|
| Right sidebar | Ribbon **timer**, or command **Open Pomofocus in Sidebar** |
| Popout window | Command **Open Pomofocus in Small Window** (480×720); falls back to sidebar if `openPopoutLeaf` is missing |
| Floating modal | Command **Open Pomofocus in Floating Window**; also opens when a period-end notification is clicked |

Commands also include **Start / Pause Pomofocus Timer** and **Reload Pomofocus Settings from Disk**.

## Timer

Modes: **Pomodoro**, **Short Break**, **Long Break**. Defaults: 50 / 10 / 20 minutes; long break every 3 completed pomodoros (`longBreakInterval`). START / PAUSE on the card; skip appears once the period has started. Auto-start of the next break or pomodoro is on by default.

Floating modal keys: `Space` start/pause (not while typing), `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle modes, `Esc` close.

## Tasks

Enabled by default (`enableTasks`). Each `TaskItem` tracks `actPomodoros / estPomodoros`. Completing a pomodoro increments the **active** task. Optional **Auto Check Tasks** marks it complete when actual ≥ estimate; **Check to Bottom** moves finished rows down.

Disable the whole list from Obsidian Settings → Fluent Pomofocus → **Enable tasks**, or from the in-app Setting modal.

## Alarms & notices

Thirteen `SoundType` values plus `none`. Focus and break can share one set or use **Separate sound for breaks**. Volume 0–100 (playback gain is doubled in the audio graph); repeat 1–10. First `start()` requests Notification permission. Period end: in-app `Notice` (6 s) plus a silent native notification; titles are **Rest!** after focus and **Focus!** after a break. Click focuses the Obsidian window and opens the floating modal.

MP3s live under `sounds/` (or are downloaded from pomofocus.io / Marinara / Super Productivity URLs in `SOUND_METAS` and cached there). If load fails, `SoundService` synthesizes a fallback.

## Settings & storage

In-app **Setting** (timer lengths, automation, tasks, dual sounds, theme swatches, dark-mode-when-running) or Obsidian Settings tab (tasks toggle, both alarm dropdowns, custom path).

Canonical JSON: `.obsidian/fluent-pomofocus.json` (not the plugin folder, so updates do not wipe tasks). Optional `customStoragePath` inside the vault; the default file is still written as an anchor. `plugin.saveData` (`data.json`) is a mirror only. First load migrates legacy `data.json` and copies old `alarmSound` into empty `focusAlarmSound` / `breakAlarmSound`.

Themes: `obsidian` (CSS variables), `teal`, `green`, `blue`. Painted themes shift by mode; with **Dark Mode when running** the running background is `#151719`.

## Layout

```
src/main.ts                 FluentPomofocusPlugin, view wrapper, setting tab
src/models/types.ts         TimerMode, SoundType, TaskItem, PomofocusSettings
src/services/TimerService.ts
src/services/SoundService.ts
src/services/NotificationService.ts
src/services/SettingsService.ts
src/ui/PomofocusView.svelte
src/ui/SettingModal.svelte
src/ui/PomofocusModal.ts
src/styles.css              leaf padding + `.fluent-pomofocus-modal`
```

Module contracts: [docs/modules/](./docs/modules/).
