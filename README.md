# Fluent Pomofocus

Obsidian plugin that recreates [Pomofocus](https://pomofocus.io) inside the vault: drift-free countdown, dual focus/break alarms, system + in-app notices, optional task list, and three surfaces (sidebar, popout leaf, floating modal).

Architecture (agents): [ARCHITECTURE.md](./ARCHITECTURE.md).

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

Entry: `src/main.ts`. Bundler: `esbuild.config.mjs`.

## Open the timer

| Surface | How |
|---|---|
| Right sidebar | Ribbon **timer**, or command **Open Pomofocus in Sidebar** |
| Popout window | Command **Open Pomofocus in Small Window** (480×720); falls back to sidebar if `openPopoutLeaf` is missing |
| Floating modal | Command **Open Pomofocus in Floating Window**; also opens when a period-end notification is clicked |

Also: **Start / Pause Pomofocus Timer**, **Reload Pomofocus Settings from Disk**.

## Timer

Modes: **Pomodoro**, **Short Break**, **Long Break**. Defaults: 50 / 10 / 20 minutes; long break every 3 completed pomodoros. START / PAUSE on the card; skip appears once the period has started. Auto-start of the next break or pomodoro is on by default.

Floating modal keys: `Space` start/pause (not while typing), `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle modes, `Esc` close.

## Tasks, alarms, settings

Tasks are on by default. Each task tracks actual / estimated pomodoros. Completing a pomodoro increments the **active** task. Optional **Auto Check Tasks** marks it complete when actual ≥ estimate.

Thirteen alarm sounds plus silent. Focus and break can share one set or use **Separate sound for breaks**. First START requests Notification permission. Period end: in-app notice (6 s) plus a silent native notification. Click focuses Obsidian and opens the floating modal.

Canonical JSON: `.obsidian/fluent-pomofocus.json` (not the plugin folder, so updates do not wipe tasks). Optional custom path inside the vault. Themes: Obsidian, teal, green, blue.
