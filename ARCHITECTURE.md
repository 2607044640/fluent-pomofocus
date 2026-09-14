# Fluent Pomofocus Architecture

Obsidian plugin (`manifest.json` id `fluent-pomofocus`, v1.2.0, `minAppVersion` 1.7.2, `isDesktopOnly: false`). Entry `src/main.ts` bundles via `esbuild.config.mjs` (esbuild-svelte, CSS injected, CJS, `es2018`) to `main.js`. `copyCssPlugin` copies `main.css` → `styles.css`. One plugin-owned `TimerService` + `SoundService`; three hosts mount the same `PomofocusView.svelte`.

## Global Invariants

1. Settings persist outside the plugin directory (Why chosen over `data.json` only: plugin updates wipe `plugins/fluent-pomofocus/`). Canonical file is `${vault.configDir}/fluent-pomofocus.json` via `SettingsService`. `plugin.saveData` is a mirror.
2. Remaining time is wall-clock (`targetEndTime - Date.now()`), not tick counting (Why chosen over `remainingSeconds--`: Electron background throttling drifts). Interval is 200 ms; UI is notified only when the rounded second changes.
3. One plugin-owned `TimerService` + `SoundService`; views subscribe and do not own timers (Why chosen over per-view timers: sidebar, popout, and modal must stay in lockstep).

## Progressive Router

| Subsystem | Doc | Owns | Do not put here |
|---|---|---|---|
| Plugin host | [plugin-host](./docs/modules/plugin-host.md) | `FluentPomofocusPlugin`, `PomofocusViewWrapper`, `PomofocusSettingTab`, ribbon, commands | Tick math, vault JSON I/O, Web Audio, Svelte templates |
| Timer engine | [timer](./docs/modules/timer.md) | `TimerService`, `TimerState`, pomodoro / shortBreak / longBreak machine | Vault I/O, Svelte rendering, task-list mutation |
| Audio & notifications | [audio-notifications](./docs/modules/audio-notifications.md) | `SoundService`, `SOUND_METAS`, `NotificationService` | Settings persistence, timer mode machine |
| Settings & persistence | [settings](./docs/modules/settings.md) | `PomofocusSettings`, `DEFAULT_SETTINGS`, `TaskItem`, `SettingsService` | Timer ticking, Svelte forms, `AudioContext` |
| Svelte UI | [ui](./docs/modules/ui.md) | `PomofocusView.svelte`, `SettingModal.svelte`, `PomofocusModal`, `src/styles.css` | Adapter I/O, `AudioContext`, interval control |

This file is the sole agent entry. Do not duplicate module recipes, side-effects API tables, or command-palette tutorials here.

## Source layout

| Path | Role |
|---|---|
| `src/main.ts` | Plugin class, `ItemView` wrapper, `PluginSettingTab` |
| `src/models/types.ts` | `VIEW_TYPE_POMOFOCUS`, `TimerMode`, `SoundType`, `TaskItem`, `PomofocusSettings`, `DEFAULT_SETTINGS` |
| `src/services/TimerService.ts` | Wall-clock state machine |
| `src/services/SoundService.ts` | Buffer cache, vault `sounds/`, synth fallback |
| `src/services/NotificationService.ts` | Static `Notice` + silent native `Notification` |
| `src/services/SettingsService.ts` | Dedicated JSON load/save + legacy migrate |
| `src/ui/PomofocusView.svelte` | Shared timer chrome + tasks |
| `src/ui/SettingModal.svelte` | In-app settings overlay |
| `src/ui/PomofocusModal.ts` | Floating `Modal` host + capture-phase keys |
| `src/styles.css` | Leaf padding + floating-modal chrome |

## Shared vocabulary

- `VIEW_TYPE_POMOFOCUS` = `"fluent-pomofocus-view"`
- `TimerMode` = `"pomodoro"` | `"shortBreak"` | `"longBreak"`
- `SoundType` = 13 named alarms + `"none"`
- Settings writes go through `FluentPomofocusPlugin.updateAndBroadcastSettings(partial, source)` (`source`: `"setting-tab"` | `"modal"` | `"reload"`). `SettingModal` ignores `"modal"` echoes when refreshing `localSettings`.

## Hosts (construction only)

| Host | Construction | Notes |
|---|---|---|
| Sidebar | `activateView` → right leaf `setViewState({ type: VIEW_TYPE_POMOFOCUS })` | `PomofocusViewWrapper` icon `"timer"` |
| Popout | `openPopoutWindow` → `openPopoutLeaf({ size: { width: 480, height: 720 } })` | Falls back to sidebar |
| Modal | `openFloatingModal` → `new PomofocusModal(app, plugin)` | Single `activeModal`; click-to-reopen from notices |

Command ids and recipes: [plugin-host](./docs/modules/plugin-host.md).

## Cross-module handoff

`onload` constructs `SettingsService`, registers `PomofocusSettingTab`, `loadSettings`, then `SoundService.preloadAll` and `TimerService`. `onStateChange` persists `currentMode` / `pomodoroRound`. `onNotificationClick` opens the floating modal. `onunload` calls `timerService.destroy()` only (no extra save). Period-end alarm + `"Rest!"` / `"Focus!"` notice live in [timer](./docs/modules/timer.md) calling [audio-notifications](./docs/modules/audio-notifications.md). Task `actPomodoros` increment lives in [ui](./docs/modules/ui.md) via `onPomodoroComplete`. Plugin-folder `data.json` is a runtime mirror, not `DEFAULT_SETTINGS`.
