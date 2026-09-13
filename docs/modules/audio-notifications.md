# Audio & Notifications

Alarm playback (cached MP3 or oscillator fallback) and dual-channel notices. Sources: `src/services/SoundService.ts`, `src/services/NotificationService.ts`.

## Scope Boundaries

| Component | Responsible For | MUST NOT Contain |
|---|---|---|
| `SOUND_METAS` | Filename + remote URL for each `SoundType` except `"none"` | Timer mode logic |
| `SoundService` | `AudioContext`, buffer cache, vault `sounds/` cache, sequential repeats, synth fallback, `stopSound` | Settings persistence, `Notice` / `Notification` UI |
| `NotificationService` | Permission request, Obsidian `Notice` (6 s), native `Notification`, Electron window focus | Audio graph |

## Key Invariants

1. `playSound` always `stopSound()` first and bumps `currentPlayId` so overlapping alarms cannot stack (Why chosen over mixing sources: a new period or test-click must replace, not layer, the previous alarm).
2. Native notifications are `{ silent: true }` (Why chosen over OS sound: `SoundService` already plays the configured alarm).
3. Load order is memory cache → `${manifest.dir}/sounds/${filename}` → `fetch(meta.url)` then `writeBinary` (Why chosen over fetch-only: vault cache survives offline after first download; synth runs if both fail).

## Numbered Data Flow

1. `onload` constructs `SoundService(app, manifest)` and `void preloadAll()` (fires `loadSound` for every key in `SOUND_METAS`).
2. Period complete or Setting modal test → `playSound(type, volumePercent, repeat)`.
3. `"none"` or `volumePercent <= 0` → `stopSound()` and return.
4. Clamp volume to `[0, 1]`, repeat to `[1, 10]`; load buffer if missing.
5. Buffer path: `playAudioBuffer` — gain `volume * 2.0` through `DynamicsCompressorNode`; 100 ms gap between repeats.
6. Miss path: `playSynthesized` → `dispatchSynthOneShot` (`synthWood` … `synthPositive`).
7. Parallel: `NotificationService.notify(title, message?, onClick?)` creates `Notice` (clickable if `onClick`) and, if `Notification.permission === "granted"`, a silent system notification.
8. Click → `focusObsidianWindow()` (`window.focus` + optional Electron `remote.getCurrentWindow` restore/show/focus) then `onClick` (plugin opens floating modal).

## Side-effects API

| Method | Signature | Side-Effects |
|---|---|---|
| `SoundService.preloadAll` | `() => Promise<void>` | Background `loadSound` per type |
| `SoundService.isPlaying` | `() => boolean` | Reads active sources / oscillators / `pendingTimer` |
| `SoundService.stopSound` | `() => void` | Increments `currentPlayId`; stops nodes; clears timeout |
| `SoundService.loadSound` | `(type: SoundType) => Promise<AudioBuffer \| null>` | May `mkdir`/`writeBinary` under plugin `sounds/`; `fetch` remote URL; `decodeAudioData` |
| `SoundService.playSound` | `(type: SoundType, volumePercent: number, repeat: number) => Promise<void>` | Stops prior audio; starts buffer or synth repeats |
| `NotificationService.requestPermissionIfNeeded` | `() => void` | `Notification.requestPermission()` if `"default"` |
| `NotificationService.focusObsidianWindow` | `() => void` | `window.focus`; Electron restore/show/focus |
| `NotificationService.notify` | `(title: string, message?: string, onClick?: () => void) => void` | `new Notice(..., 6000)`; optional native `Notification` |

## Recipes

### Play the focus alarm when a pomodoro ends

1. `TimerService.completeCurrentPeriod(true)` with `completedMode === "pomodoro"`.
2. `soundType = focusAlarmSound \|\| alarmSound \|\| "wood"`; volume/repeat from focus fields with legacy fallbacks.
3. `void soundService.playSound(soundType, volume, repeat)` (`src/services/SoundService.ts`).
4. `NotificationService.notify("Rest!", undefined, onNotificationClick)`.

### Test a sound in the in-app settings modal

1. `SettingModal.testSound("focus" \| "break", forcePlay)` (`src/ui/SettingModal.svelte`).
2. If already playing and `!forcePlay`, `stopSound()` (toggle off).
3. Else `playSound` with the local focus or break fields.

### Cache a missing MP3

1. `loadSound("gong")` (example) checks `audioBufferCache`, then `adapter.exists(pluginDir/sounds/alarm-gong.mp3)`.
2. On miss, `fetch` `SOUND_METAS.gong.url` (Marinara GitHub raw), `mkdir` `sounds/` if needed, `writeBinary`, decode into cache.

<!-- BEGIN USER-SPECIFIED -->
<!-- END USER-SPECIFIED -->
