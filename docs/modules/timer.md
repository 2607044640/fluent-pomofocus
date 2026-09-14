# Timer Engine

Wall-clock pomodoro state machine. Source: `src/services/TimerService.ts`. Types: `src/models/types.ts` (`TimerMode`).

## Scope Boundaries

| Component | Responsible For | MUST NOT Contain |
|---|---|---|
| `TimerService` | Mode, round, remaining/total seconds, start/pause/toggle/reset/skip, 200 ms interval, period completion | Vault I/O, Svelte rendering, task list mutation |
| `TimerState` | Snapshot: `mode`, `isRunning`, `remainingSeconds`, `totalSeconds`, `round`, `formattedTime` (`MM:SS`) | Persistence keys |
| Callbacks | `onPomodoroComplete`, `onStateChange`, `onNotificationClick` | Direct UI construction |

## Key Invariants

1. Tick uses `targetEndTime - Date.now()` rounded to seconds, interval 200 ms (Why chosen over decrement-per-interval: hidden Electron windows throttle `setInterval` and the clock would run slow).
2. Duration changes from `updateSettings` apply only when `!isRunning` (Why chosen over live-resize of an active period: mid-run length jumps surprise the user).
3. `skip()` completes without alarm/notification (`playAlert = false`); natural expiry plays sound + `NotificationService.notify` (Why chosen over always alerting: skip is an explicit user advance).

## Numbered Data Flow

1. Constructor copies `settings.currentMode` (default `"pomodoro"`) and `settings.pomodoroRound` (default `1`), then `initDurationForMode` (`pomoTime` / `shortBreakTime` / `longBreakTime` × 60).
2. `start()`: no-op if already running; if `remainingSeconds <= 0`, re-init; `NotificationService.requestPermissionIfNeeded()`; `targetEndTime = Date.now() + remainingSeconds * 1000`; `setInterval(tick, 200)`.
3. `tick()` writes `remainingSeconds` only when the rounded value changes; at `<= 0` calls `completeCurrentPeriod(true)`.
4. `pause()` clears the interval and locks remaining from `targetEndTime`.
5. `completeCurrentPeriod(playAlert)`: `pause()`, zero remaining.
6. If `playAlert`: pick focus vs break `SoundType` / volume / repeat (focus fields fall back to legacy `alarmSound` / `alarmVolume` / `alarmRepeat`, else `"wood"` / `80` / `2`; break else `"bell"`); `soundService.playSound`; `NotificationService.notify("Rest!" \| "Focus!", undefined, onNotificationClick)`.
7. If completed `"pomodoro"`: `onPomodoroComplete?()`; next mode is `"longBreak"` when `round % longBreakInterval === 0`, else `"shortBreak"`; `switchMode(next, autoStartBreaks)`. Round does **not** increment here.
8. If completed a break: `round += 1`; `switchMode("pomodoro", autoStartPomodoros)`.
9. `switchMode` always `pause()`, re-inits duration, optionally `start()`, always `emitStateChange()`.

## Side-effects API

| Method | Signature | Side-Effects |
|---|---|---|
| `subscribe` | `(listener: (state: TimerState) => void) => () => void` | Immediate `listener(getState())`; unsubscribe removes from `listeners` |
| `getState` | `() => TimerState` | None (formats `MM:SS`) |
| `updateSettings` | `(newSettings: PomofocusSettings) => void` | Replaces `settings`; if paused, `initDurationForMode` + `notify` |
| `switchMode` | `(targetMode: TimerMode, autoStart?: boolean) => void` | Pause, change mode, re-init; may `start()`; `onStateChange` |
| `start` | `() => void` | Permission prompt, interval, `isRunning = true` |
| `pause` | `() => void` | Clears interval; locks remaining from `targetEndTime` |
| `toggle` | `() => void` | `pause` or `start` |
| `reset` | `() => void` | Pause, re-init current mode, `onStateChange` |
| `skip` | `() => void` | `completeCurrentPeriod(false)` — no sound/notice |
| `getSettings` | `() => PomofocusSettings` | Returns internal reference (not a copy) |
| `destroy` | `() => void` | `clearInterval`, `listeners.clear()`; no save |

## Recipes

### Start / pause from UI or command

1. `PomofocusView.toggleTimer` or command `toggle-timer` → `TimerService.toggle` (`src/services/TimerService.ts`).
2. First `start()` requests Notification permission if `"default"`.

### Advance after a finished focus session

1. `tick` hits 0 → `completeCurrentPeriod(true)`.
2. Plays `focusAlarmSound` (else `alarmSound` else `"wood"`) at `focusAlarmVolume` / `focusAlarmRepeat`.
3. Notifies title `"Rest!"`.
4. `onPomodoroComplete` (view increments `actPomodoros` on `activeTaskId`).
5. `round % longBreakInterval === 0` → long break, else short break; auto-start if `autoStartBreaks`.

### Change mode from tabs without auto-start

1. `PomofocusView.handleModeChange(mode)` sets `settings.currentMode`, `timerService.switchMode(mode, false)`, `onSaveSettings()`.
2. Running timer is paused; remaining resets to the target mode duration.

<!-- BEGIN USER-SPECIFIED -->
<!-- END USER-SPECIFIED -->
