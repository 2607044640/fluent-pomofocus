# A1 Pomofocus — Architectural Specification

<context>
For user documentation and usage instructions, please refer to: [_README.md](file:///c:/ObsidianDev/plugins/A1Pomofocus/_README.md).
</context>

## 1. System Overview & Data Flow

```mermaid
graph TD
    Plugin[A1PomofocusPlugin main.ts] --> TimerService[TimerService]
    Plugin --> SoundService[SoundService]
    Plugin --> NotificationService[NotificationService]
    Plugin --> ViewWrapper[PomofocusViewWrapper ItemView]
    ViewWrapper --> View[PomofocusView.svelte]
    View --> Modal[SettingModal.svelte]
    TimerService --> SoundService
    TimerService --> NotificationService

    Modal -.->|updateAndBroadcastSettings live autosave| Plugin
    Plugin -.->|onSettingsChange broadcast| View
```

### 1.1 Data Movement Flow
1. **User Action**: The user edits a configuration option inside the **In-View Setting Modal** (`SettingModal.svelte`) in the sidebar or Small Window.
2. **Instant Autosave & Central Mutation**: The modal triggers `plugin.updateAndBroadcastSettings(patch, "modal")` (debounced on number inputs, instant on toggles/swatches/selects).
   - `Object.assign(this.settings, patch)` updates the in-memory singleton.
   - `await this.saveSettings()` asynchronously flushes to `data.json`.
3. **Timer Service Recalibration**: `TimerService.updateSettings(settings)` updates mode durations. If currently paused, it immediately resets `remainingSeconds` to the new mode duration and triggers `this.notify()`.
4. **Broadcast & UI Alignment**:
   - `PomofocusView.svelte` receives the event and updates its local reactive `settings` store, immediately updating color themes and display parameters without requiring an Obsidian restart.

---

## 2. Directory Layout
```
c:\ObsidianDev\plugins\A1Pomofocus\
├── manifest.json              # Obsidian plugin metadata
├── package.json               # Dependencies and build scripts
├── tsconfig.json              # TypeScript compiler configuration (ES2020)
├── esbuild.config.mjs         # Bundler pipeline + Zombie CSS copy plugin
├── _README.md                 # Layered user guide and cheatsheet
├── _Architecture.md           # Architecture specifications & invariants
└── src/
    ├── main.ts                # Plugin lifecycle, settings broadcaster, ItemView wrapper
    ├── declarations.d.ts      # CSS and Svelte ambient declarations
    ├── styles.css             # Base leaf styling
    ├── models/
    │   └── types.ts           # Domain models, mode types, and default settings
    ├── services/
    │   ├── SoundService.ts    # Web Audio API oscillator synthesis engine
    │   ├── TimerService.ts    # Drift-free timestamp-driven timer engine
    │   └── NotificationService.ts # Windows + Obsidian toast notification dispatcher
    └── ui/
        ├── PomofocusView.svelte # Primary Svelte view (Timer card + Task list)
        └── SettingModal.svelte  # Absolute-positioned modal settings dialog
```

---

## 3. Scope Boundaries

| Component | Responsible For | MUST NOT Contain |
| :--- | :--- | :--- |
| `A1PomofocusPlugin` | Lifecycle, settings broadcast SSOT, view registration, popout leaf trigger | Direct UI rendering, audio synthesis logic |
| `TimerService` | Absolute timestamp calculation, mode transitions, countdown tick loop | DOM manipulation, settings persistence IO |
| `SoundService` | Audio buffer fetching, local vault caching, GainNode amplification, dynamic compressor, fallback synthesis | Timer state, UI bindings |
| `NotificationService` | HTML5 Notification API and Obsidian Notice toasts | Audio playback, timer state |
| `PomofocusView.svelte` | Timer visualization, interactive task operations, small window trigger | Audio synthesis math, standalone timer interval |
| `SettingModal.svelte` | In-view configuration editing, real-time autosave dispatch, audio preview | Direct file storage operations |

---

## 4. Precise API Signatures

| Class / Method | Signature | Side-Effects |
| :--- | :--- | :--- |
| `Plugin.updateAndBroadcastSettings` | `(newSettings: Partial<PomofocusSettings>, source?: string) => Promise<void>` | Mutates `this.settings`, saves to disk, updates `TimerService`, emits to all listeners |
| `Plugin.onSettingsChange` | `(listener: (settings: PomofocusSettings, source?: string) => void) => () => void` | Registers listener in `settingsListeners` set; returns unsubscription callback |
| `TimerService.updateSettings` | `(newSettings: PomofocusSettings) => void` | Updates internal config; if paused, resets `remainingSeconds` and invokes `notify()` |
| `TimerService.start` | `() => void` | Sets `isRunning = true`, initializes `targetEndTime`, starts 200ms `setInterval` |
| `TimerService.pause` | `() => void` | Sets `isRunning = false`, computes remaining time from delta, stops interval |
| `SoundService.playSound` | `(type: SoundType, volumePercent: number, repeat: number) => Promise<void>` | Plays cached decoded AudioBuffer or amplified synthesized fallback |
| `SoundService.preloadAll` | `() => Promise<void>` | Asynchronously caches sound files to local vault adapter `.obsidian/plugins/A1Pomofocus/sounds/` |

---

## 5. Key System Invariants

### Invariant 1: Drift-Free Wall-Clock Synchronization
Timer countdowns MUST NOT accumulate tick-based drift. The remaining duration is calculated exclusively via:
`remainingSeconds = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000))`
This ensures zero drift even when Obsidian is minimized, backgrounded, or restored from system sleep.

### Invariant 2: Zombie CSS Protection
Obsidian loads ONLY `styles.css` from the plugin directory. `esbuild.config.mjs` MUST retain `copyCssPlugin` to guarantee that `main.css` is mirrored to `styles.css` on every build step.

<!-- BEGIN USER-SPECIFIED -->
### Invariant 3: In-View Real-Time Settings & Autosave Contract
1. **Single Unified Surface**: Configuration is managed exclusively through the in-view **Setting Modal** (`SettingModal.svelte`), accessible inside both the sidebar view and detached Small Windows.
2. **Instant Live Autosave**: Any modified preference (timer durations, automation switches, alarm sound/volume/repeat, color themes, dark mode) takes effect immediately via `syncChanges` without requiring an Obsidian restart or manual OK button confirmation.
3. **Timer Recalibration**: Active paused states immediately recalibrate the countdown timer display to newly chosen mode durations.
4. **Clean Hit-Testing**: The modal explicitly avoids Chromium `backdrop-filter` rendering bugs by using clean RGBA backdrop layering and isolated pointer events.

### Invariant 4: Dual-Engine High-Fidelity Audio & Loudness Architecture
1. **Official High-Definition Samples**: Downloads and caches real acoustic audio for Wood (木鱼), Bell (清脆钟鸣), Bird (自然鸟鸣), Digital (电子闹铃), and Kitchen (机械闹钟) into vault storage (`.obsidian/plugins/A1Pomofocus/sounds/`) for zero-latency offline playback.
2. **200% Gain Amplification & Dynamics Limiting**: Routes sound through `AudioContext` with `GainNode` scaling up to 2.0x and `DynamicsCompressorNode` (-12dB threshold, 10:1 ratio, 3ms attack) to ensure alerts are loud and crisp across low-power laptop speakers without clipping or distortion.
3. **Multi-Harmonic Synthesized Fallback**: If offline or before initial download finishes, instant synthesized multi-harmonic oscillators ensure notifications are never missed.
4. **Interactive Volume Control & Sequential Repeat Engine**: Setting modal provides 0-100% slider and repeat counter (1-10) with live preview on slider release, dropdown change, and number input. Playback employs an interruptible `onended` sequential repeat loop with a 100ms natural acoustic cadence, while `stopSound()` guarantees instant cutoff without overlapping when re-triggered or closed.
<!-- END USER-SPECIFIED -->
