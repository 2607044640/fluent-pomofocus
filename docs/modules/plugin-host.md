# Plugin Host

Obsidian lifecycle, view registration, commands, and settings broadcast. Source: `src/main.ts`.

## Scope Boundaries

| Component | Responsible For | MUST NOT Contain |
|---|---|---|
| `FluentPomofocusPlugin` | `onload` / `onunload`, service construction, commands, ribbon, view/modal/popout hosts, settings listener fan-out | Timer tick math, Web Audio playback, vault JSON I/O details |
| `PomofocusViewWrapper` | `ItemView` leaf for `VIEW_TYPE_POMOFOCUS`; mounts/destroys `PomofocusView` | Settings schema, sound loading |
| `PomofocusSettingTab` | Obsidian Settings pane: `enableTasks`, `focusAlarmSound`, `breakAlarmSound`, `customStoragePath` | Full in-app Setting modal UI |

## Key Invariants

1. `settings` is a mutable object on the plugin; writers go through `updateAndBroadcastSettings` (Why chosen over silent `Object.assign`: every host must receive the same snapshot via `settingsListeners`).
2. At most one `PomofocusModal` (`activeModal`); a second open is a no-op if `containerEl` is still in `document.body` (Why chosen over stacking modals: one shared timer UI).
3. `onunload` only destroys the timer interval; it does not write settings (Why chosen over save-on-unload: mode/round already persist on `onStateChange`).

## Numbered Data Flow

1. Obsidian loads `main.js` → `FluentPomofocusPlugin.onload()`.
2. `new SettingsService(app, this)` → `addSettingTab(PomofocusSettingTab)` → `await loadSettings()`.
3. `new SoundService(app, manifest)` → `preloadAll()`; `new TimerService(settings, soundService)`.
4. Wire `onStateChange` (persist `currentMode`/`pomodoroRound`) and `onNotificationClick` (`openFloatingModal`).
5. `registerView("fluent-pomofocus-view", leaf => new PomofocusViewWrapper(leaf, this))`.
6. Ribbon `timer` and commands route to `activateView` / `openPopoutWindow` / `openFloatingModal` / `timerService.toggle` / `loadSettings`.
7. `PomofocusViewWrapper.onOpen` mounts `PomofocusView` with `plugin`, `settings`, `timerService`, `soundService`, `onSaveSettings`, `onOpenSmallWindow`.
8. `onunload` → `timerService.destroy()`.

## Side-effects API

| Method | Signature | Side-Effects |
|---|---|---|
| `onSettingsChange` | `(listener: (settings: PomofocusSettings, source?: string) => void) => () => void` | Adds/removes listener in `settingsListeners` |
| `updateAndBroadcastSettings` | `(newSettings: Partial<PomofocusSettings>, source?: string) => Promise<void>` | Mutates `this.settings`, `saveSettings()`, `timerService.updateSettings`, invokes listeners |
| `loadSettings` | `() => Promise<void>` | Replaces `this.settings` from `SettingsService.loadSettings` |
| `saveSettings` | `() => Promise<void>` | `SettingsService.saveSettings(this.settings)` |
| `activateView` | `() => Promise<void>` | Reveals existing leaf or `getRightLeaf` + `setViewState` |
| `openPopoutWindow` | `() => Promise<void>` | `workspace.openPopoutLeaf({ size: { width: 480, height: 720 } })` or falls back to `activateView` |
| `openFloatingModal` | `() => void` | Constructs `PomofocusModal` and `open()` |
| `onModalClose` | `() => void` | Clears `activeModal` |
| `PomofocusViewWrapper.onOpen` | `() => Promise<void>` | Instantiates Svelte `PomofocusView` into leaf content |
| `PomofocusViewWrapper.onClose` | `() => Promise<void>` | `$destroy()` on Svelte component |
| `PomofocusSettingTab.display` | `() => void` | Builds Obsidian `Setting` toggles/dropdowns/text; writes via `updateAndBroadcastSettings(..., "setting-tab")` |

## Recipes

### Open the sidebar view

1. Command `open-sidebar` or ribbon `timer` → `FluentPomofocusPlugin.activateView` (`src/main.ts`).
2. If no leaf of type `fluent-pomofocus-view`, `workspace.getRightLeaf(false)` then `setViewState({ type, active: true })`.
3. `workspace.revealLeaf(leaf)` → `PomofocusViewWrapper.onOpen` mounts `PomofocusView`.

### Broadcast a setting from the Obsidian tab

1. Toggle/dropdown `onChange` in `PomofocusSettingTab.display`.
2. `await plugin.updateAndBroadcastSettings({ ... }, "setting-tab")`.
3. Persist, `timerService.updateSettings`, notify Svelte hosts (`source !== "modal"` so `SettingModal` refreshes `localSettings`).

### Toggle timer from a command (no UI required)

1. Command `toggle-timer` → `this.timerService.toggle()` (`src/main.ts`).
2. No view mount required; the shared service is constructed in `onload`.

<!-- BEGIN USER-SPECIFIED -->
<!-- END USER-SPECIFIED -->
