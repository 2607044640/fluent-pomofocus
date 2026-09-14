# Settings & Persistence

Schema, defaults, vault-file I/O, and dual-alarm migration. Sources: `src/models/types.ts`, `src/services/SettingsService.ts`.

## Scope Boundaries

| Component | Responsible For | MUST NOT Contain |
|---|---|---|
| `PomofocusSettings` / `TaskItem` / `DEFAULT_SETTINGS` | Canonical shape and factory defaults | File paths, Obsidian adapter calls |
| `SettingsService` | Effective path, load with fallback/migration, save to dedicated file + `plugin.saveData` mirror | Timer ticking, Svelte forms |
| Plugin `settings` object | Live mutable instance used by timer and UI | Direct `adapter.write` (must go through this service) |

## Key Invariants

1. Canonical file is `${app.vault.configDir}/fluent-pomofocus.json` (usually `.obsidian/fluent-pomofocus.json`), not `plugins/fluent-pomofocus/data.json` (Why chosen over plugin `data.json` as SSOT: community-plugin updates delete that folder).
2. Load merges `Object.assign({}, DEFAULT_SETTINGS, loaded)` then copies legacy `alarmSound`/`alarmVolume`/`alarmRepeat` into empty focus/break fields (Why chosen over failing closed: v1 single-alarm payloads must keep working).
3. Save mirrors `focusAlarm*` back onto `alarmSound`/`alarmVolume`/`alarmRepeat`, writes the target path, writes the default path if custom, and `plugin.saveData` (Why chosen over a single write: reload and older code paths still find a copy).

`data.json` in the plugin folder is a runtime mirror/snapshot, not `DEFAULT_SETTINGS`.

## Numbered Data Flow

1. `getEffectivePath(customPath?)`: trimmed custom path, else `${configDir}/fluent-pomofocus.json`.
2. `loadSettings()`: read default dedicated file if it exists and is non-empty JSON.
3. If that object has `customStoragePath`, try that file and replace `loaded`.
4. If nothing loaded: `plugin.loadData()` (legacy `data.json`); log migration.
5. Merge defaults; dual-alarm compat; if the dedicated default file was missing, `saveSettings` immediately (locks migration).
6. `saveSettings(settings)`: sync legacy alarm mirrors; `mkdir` parent if needed; `adapter.write(targetPath, pretty JSON)`.
7. If `targetPath !== defaultPath`, also write the default path (anchor so next boot knows `customStoragePath`).
8. `plugin.saveData(settings)` as safety mirror.

## Side-effects API

| Method | Signature | Side-Effects |
|---|---|---|
| `getEffectivePath` | `(customPath?: string) => string` | None |
| `loadSettings` | `() => Promise<PomofocusSettings>` | `adapter.exists`/`read`, optional `plugin.loadData`, may `saveSettings` to migrate |
| `saveSettings` | `(settings: PomofocusSettings) => Promise<void>` | Mutates legacy alarm fields on `settings`; `mkdir`/`write`; `plugin.saveData` |

### Defaults (`DEFAULT_SETTINGS` in `src/models/types.ts`)

| Field | Default |
|---|---|
| `pomoTime` / `shortBreakTime` / `longBreakTime` | `50` / `10` / `20` (minutes) |
| `longBreakInterval` | `3` |
| `autoStartBreaks` / `autoStartPomodoros` | `true` |
| `enableTasks` / `autoCheckTasks` / `checkToBottom` | `true` / `false` / `true` |
| `alarmSound` / `alarmVolume` / `alarmRepeat` | `"wood"` / `80` / `2` (legacy mirrors) |
| `focusSound` | `"none"` (persisted; unused by current UI) |
| `focusAlarmSound` / `breakAlarmSound` | `"wood"` / `"bell"` |
| `focusAlarmVolume` / `breakAlarmVolume` | `80` |
| `focusAlarmRepeat` / `breakAlarmRepeat` | `2` |
| `colorTheme` / `hourFormat` / `darkModeWhenRunning` | `"obsidian"` / `"24"` / `false` (`hourFormat` persisted; unused by current UI) |
| `customStoragePath` | `""` |
| `currentMode` / `pomodoroRound` | `"pomodoro"` / `1` |
| `tasks` / `activeTaskId` | `[]` / `null` |

`TaskItem`: `id`, `title`, `completed`, `actPomodoros`, `estPomodoros`, `note?`, `createdAt`.

## Recipes

### Change the dedicated file location

1. Obsidian Settings → `PomofocusSettingTab` text field `customStoragePath`.
2. `updateAndBroadcastSettings({ customStoragePath: val.trim() }, "setting-tab")`.
3. Next `saveSettings` writes both the custom path and the default anchor file.

### Reload from disk without restarting Obsidian

1. Command `reload-settings` → `loadSettings()` then `timerService.updateSettings(this.settings)`.
2. Fan-out listeners with `source === "reload"`; `new Notice("Fluent Pomofocus settings reloaded from disk.")`.

### Persist task edits from the view

1. `PomofocusView` mutates `settings.tasks` / `activeTaskId` then `void onSaveSettings()`.
2. That callback is `() => plugin.saveSettings()` → `SettingsService.saveSettings(this.settings)`.

<!-- BEGIN USER-SPECIFIED -->
<!-- END USER-SPECIFIED -->
