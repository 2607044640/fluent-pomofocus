# Svelte UI

Timer chrome, task list, in-app settings overlay, and floating modal host. Sources: `src/ui/PomofocusView.svelte`, `src/ui/SettingModal.svelte`, `src/ui/PomofocusModal.ts`, `src/styles.css`.

## Scope Boundaries

| Component | Responsible For | MUST NOT Contain |
|---|---|---|
| `PomofocusView` | Mode tabs, countdown, START/PAUSE/skip, tasks CRUD, theme background, settings overlay mount | Vault adapter I/O, `AudioContext` |
| `SettingModal` | Local draft of `PomofocusSettings`, debounce sync, sound test, theme swatches | `TimerService` interval control (except reading `getState().mode` for badges) |
| `PomofocusModal` | Obsidian `Modal` wrapper, keyboard (Esc / Space / Ctrl+Tab), `no-tasks` class | Sound decoding |

## Key Invariants

1. All hosts receive the same `timerService` / `settings` props; the view subscribes on mount and unsubscribes on destroy (Why chosen over copying timer state into the plugin: one clock, many surfaces).
2. `SettingModal` edits `localSettings` and pushes via `plugin.updateAndBroadcastSettings(cleaned, "modal")`; incoming listeners ignore `source === "modal"` to avoid clobbering the draft (Why chosen over two-way bind on `plugin.settings`: sliders would fight in-flight broadcasts).
3. `onPomodoroComplete` is assigned by `PomofocusView.onMount` (last mounted view wins) and mutates `actPomodoros` / optional auto-check (Why chosen over putting tasks in `TimerService`: the engine stays UI-agnostic).

## Numbered Data Flow

1. Host (`PomofocusViewWrapper.onOpen` or `PomofocusModal.onOpen`) constructs `PomofocusView` with `plugin`, `settings`, `timerService`, `soundService`, `onSaveSettings`, `onOpenSmallWindow`, optional `isModal`/`onClose`.
2. `onMount`: `timerService.subscribe` → `timerState`; `plugin.onSettingsChange` copies settings; assign `onPomodoroComplete`.
3. User START/PAUSE → `timerService.toggle()`; skip → `timerService.skip()`; tab → `switchMode(mode, false)` + save.
4. Task add/complete/delete/clear → mutate `settings.tasks` / `activeTaskId` → `onSaveSettings()`.
5. Setting button → `showSettingModal = true` → `SettingModal` with `createEventDispatcher` `close` / `save`.
6. Modal inputs `syncChanges(immediate)` (200 ms debounce unless immediate) → `sanitize` (min durations 1, volume 0–100, repeat 1–10) → `updateAndBroadcastSettings`.
7. OK or backdrop/Esc: `soundService.stopSound()`, final sync, `dispatch("close")`.
8. Floating modal keys (capture phase): Esc closes; Ctrl/Meta+Tab cycles modes unless settings overlay open; Space toggles if focus is not `input`/`textarea`.

## Side-effects API

| Method | Signature | Side-Effects |
|---|---|---|
| `PomofocusView.handleModeChange` | `(mode: TimerMode) => void` | Writes `settings.currentMode`, `switchMode`, `onSaveSettings` |
| `PomofocusView.toggleTimer` / `skipTimer` | `() => void` | `timerService.toggle` / `skip` |
| `PomofocusView.addTask` | `() => void` | Appends `TaskItem` (`id: "task_" + Date.now() + …`), may set `activeTaskId` |
| `PomofocusView.toggleTaskComplete` | `(task: TaskItem) => void` | Flips `completed`; optional `reorderTasks` |
| `PomofocusView.deleteTask` / `clearFinishedTasks` / `clearAllTasks` | `(id?: string) => void` | Mutates task list; repairs `activeTaskId` |
| `PomofocusView.cycleMode` | `(direction: 1 \| -1) => void` | Cycles `pomodoro → shortBreak → longBreak` |
| `PomofocusView.handleSaveModal` | `(e: CustomEvent<PomofocusSettings>) => Promise<void>` | `plugin.updateAndBroadcastSettings(e.detail, "modal")` |
| `SettingModal.syncChanges` | `(immediate?: boolean) => void` | Debounced or immediate broadcast of `sanitize(localSettings)` |
| `SettingModal.testSound` | `(target: "focus" \| "break", forcePlay?: boolean) => void` | Toggle-stop or `playSound` |
| `SettingModal.handleSave` / `handleClose` | `() => void` | `stopSound`, sync, dispatch |
| `PomofocusModal.onOpen` | `() => void` | Mounts view, `keydown` listener, `fluent-pomofocus-modal` / `no-tasks` classes |
| `PomofocusModal.onClose` | `() => void` | `plugin.onModalClose()`, unsubscribe, remove listener, `$destroy()` |

## Recipes

### Add a task and make it active if none is selected

1. `PomofocusView.addTask` (`src/ui/PomofocusView.svelte`) requires non-empty `newTaskTitle`.
2. Builds `TaskItem` with `estPomodoros = max(1, newTaskEst \|\| 1)`.
3. If `activeTaskId` is null, assigns the new id; `onSaveSettings()`.

### Cycle modes from the floating window

1. `PomofocusModal` keydown: Ctrl+Tab / Ctrl+Shift+Tab when `.pomo-modal-backdrop` is absent.
2. `cycleMode(±1)` writes `plugin.settings.currentMode`, `timerService.switchMode(next, false)`, `saveSettings()`.

### Apply Obsidian theme vs painted themes

1. `colorTheme === "obsidian"` → CSS class `theme-obsidian` (uses `--background-secondary`, `--interactive-accent`, etc.).
2. Otherwise `getThemeBgColor(mode, theme, isRunning, darkModeWhenRunning)` sets inline `background-color` (teal/green/blue; `#151719` when running + dark mode).

<!-- BEGIN USER-SPECIFIED -->
<!-- END USER-SPECIFIED -->
