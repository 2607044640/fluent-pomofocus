# Fluent Pomofocus Architecture

Obsidian plugin (`manifest.json` id `fluent-pomofocus`, v1.2.0). Entry `src/main.ts` bundles via `esbuild.config.mjs` to `main.js`. One shared `TimerService`; three hosts (sidebar `ItemView`, popout leaf, `PomofocusModal`) mount the same `PomofocusView.svelte`.

## Global Invariants

1. Settings persist outside the plugin directory (Why chosen over `data.json` only: plugin updates wipe `plugins/fluent-pomofocus/`). Canonical file is `${vault.configDir}/fluent-pomofocus.json` via `SettingsService`.
2. Remaining time is wall-clock (`targetEndTime - Date.now()`), not tick counting (Why chosen over `remainingSeconds--`: Electron background throttling drifts).
3. One plugin-owned `TimerService` + `SoundService`; views subscribe and do not own timers (Why chosen over per-view timers: sidebar, popout, and modal must stay in lockstep).

## Progressive Router

| Subsystem | Owns | Module |
|---|---|---|
| Plugin host | `FluentPomofocusPlugin`, `PomofocusViewWrapper`, `PomofocusSettingTab`, commands, ribbon | [plugin-host](./docs/modules/plugin-host.md) |
| Timer engine | `TimerService`, `TimerState`, pomodoro / shortBreak / longBreak machine | [timer](./docs/modules/timer.md) |
| Audio & notifications | `SoundService`, `SOUND_METAS`, `NotificationService` | [audio-notifications](./docs/modules/audio-notifications.md) |
| Settings & persistence | `PomofocusSettings`, `DEFAULT_SETTINGS`, `SettingsService` | [settings](./docs/modules/settings.md) |
| Svelte UI | `PomofocusView.svelte`, `SettingModal.svelte`, `PomofocusModal` | [ui](./docs/modules/ui.md) |

## Boot Sequence

1. `FluentPomofocusPlugin.onload()` constructs `SettingsService`, registers `PomofocusSettingTab`, then `loadSettings()`.
2. `new SoundService(app, manifest)` + `preloadAll()`; `new TimerService(settings, soundService)`.
3. `timerService.onStateChange` writes `settings.currentMode` / `pomodoroRound` then `saveSettings()`.
4. `timerService.onNotificationClick` → `openFloatingModal()`.
5. `registerView(VIEW_TYPE_POMOFOCUS)`, ribbon `timer`, commands listed below.
6. `onunload()` → `timerService.destroy()` (clears interval + listeners; no extra save).

## Hosts and commands

| Host | Construction | Notes |
|---|---|---|
| Sidebar | `activateView` → right leaf `setViewState({ type: VIEW_TYPE_POMOFOCUS })` | `PomofocusViewWrapper` icon `"timer"` |
| Popout | `openPopoutWindow` → `openPopoutLeaf({ size: { width: 480, height: 720 } })` | Falls back to sidebar |
| Modal | `openFloatingModal` → `new PomofocusModal(app, plugin)` | Single `activeModal`; click-to-reopen from notices |

Commands: `open-sidebar`, `open-small-window`, `open-floating-modal`, `toggle-timer`, `reload-settings`.

Settings writes go through `updateAndBroadcastSettings(partial, source)` so `TimerService.updateSettings` and Svelte listeners stay coherent. `source` is `"setting-tab"`, `"modal"`, or `"reload"`; `SettingModal` ignores `"modal"` echoes when refreshing `localSettings`.

## Shared Types (`src/models/types.ts`)

- `VIEW_TYPE_POMOFOCUS` = `"fluent-pomofocus-view"`
- `TimerMode` = `"pomodoro" | "shortBreak" | "longBreak"`
- `SoundType` = 13 named alarms + `"none"`
- `TaskItem`: `id`, `title`, `completed`, `actPomodoros`, `estPomodoros`, `note?`, `createdAt`
- `PomofocusSettings`: durations, automation, dual alarm sets, theme, tasks, persisted round/mode

Do not duplicate module recipes here. Follow the router table.
