# Fluent Pomofocus

<context>
For underlying architecture specifications, state management, API signatures, and developer recipes, please refer to: [_Architecture.md](file:///C:/ObsidianPublish/fluent-pomofocus/_Architecture.md).
</context>

**Fluent Pomofocus** brings a complete, lag-free recreation of the popular [Pomofocus.io](https://pomofocus.io) web app directly into Obsidian as a native desktop plugin. It eliminates browser background tab freezing and resetting, provides high-fidelity synthesized system audio chimes, native desktop notifications, and supports independent detached floating mini-windows ("Small Window").

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian Version](https://img.shields.io/badge/Obsidian-v1.0.0%2B-purple.svg)

---

<layer_1_quick_start>
## 🚀 Layer 1: Quick Start Guide

### 🛠️ Installation & Activation
1. The plugin is linked to your vault via Twin Junction at `C:\ObsidianNote\.obsidian\plugins\fluent-pomofocus` -> `C:\ObsidianPublish\fluent-pomofocus`.
2. Open Obsidian -> **Settings** -> **Community Plugins** -> Enable **Fluent Pomofocus**.
3. Click the timer icon in the left ribbon or run command `Open Pomofocus in Sidebar`.

### 🎮 Primary Controls Cheatsheet
| Action | Shortcut / Interaction | Description |
| :--- | :--- | :--- |
| **Open in Sidebar** | Command: `Open Pomofocus in Sidebar` | Mounts Pomofocus in the right sidebar |
| **Open Floating Window** | Command: `Open Pomofocus in Floating Window` | Opens in-app floating modal overlay with `Esc` / `Space` / `Ctrl+Tab` shortcuts |
| **Open Small Window** | Top Nav: `Small Window` / Command: `Open Pomofocus in Small Window` | Detaches into an independent floating mini-window |
| **Start / Pause** | Giant Button / Command: `Start / Pause Pomofocus Timer` / `Space` (in Modal) | Toggles the active countdown |
| **Switch Modes** | Tabs: `Pomodoro`, `Short Break`, `Long Break` / `Ctrl+Tab` (in Modal) | Switches period and adapts theme color |
| **Skip Mode** | Button: `>>` (Next to start button) | Manually advances to next break or pomodoro |
| **Add Task** | Button: `+ Add Task` | Inserts inline task with estimated pomodoro count |
| **Configure Settings** | Top Nav: `Setting` button / Obsidian Settings | Opens preferences with instant live autosave |
</layer_1_quick_start>

---

<layer_2_detailed_guide>
## 📖 Layer 2: Feature Specifications

### ⏱️ Drift-Free Wall-Clock Timer
- **No Background Sleeping**: Traditional browser timers use `setInterval` which gets throttled or killed when tabs lose focus. Fluent Pomofocus calculates `targetEndTime - Date.now()`, ensuring absolute precision even through laptop sleep and wake cycles.
- **Three Core Modes**:
  - `Pomodoro`: Focus work period (default 50 mins).
  - `Short Break`: Relax and recharge (default 10 mins).
  - `Long Break`: Extended recovery after a cycle of intervals (default 20 mins every 3 rounds).

### 🔔 Real Sound Library, Dual Sound Sets & Notifications
- **Dual Sound Profiles (Focus vs. Break)**: Separate sound settings for Focus sessions vs. Break periods. Customize distinct alarm sounds (e.g. Gong for Focus completion, Chime for Break completion), volume levels, and repeat counts for each state.
- **Rich 13-Acoustic Sound Library & Caching**: Offers 13 high-fidelity sound profiles:
  - *Classic & Kitchen*: `Wood` (木块/木鱼), `Bell` (清脆钟鸣), `Digital` (电子闹铃), `Kitchen` (机械闹钟), `Reception Bell` (前台叮铃)
  - *Mindfulness & Ambient*: `Gong` (禅意铜锣/颂钵), `Bird` (自然鸟鸣), `Water Drop` (清泉水滴), `Chime` (和弦风铃)
  - *Musical & Uplifting*: `Music Box` (纯净八音盒), `Glass` (水晶敲击), `Ding Dong` (门铃和弦), `Positive` (愉悦提示)
  Audio files are automatically cached in vault storage for zero-latency instant offline playback.
- **200% Loudness Amplification**: Integrated with Web Audio API `GainNode` scaling up to 2.0x alongside a `DynamicsCompressorNode`, ensuring alarm alerts are loud, crisp, and clearly audible even through quiet laptop speakers without distortion or clipping.
- **Full Synthesizer Fallback Suite**: Every single one of the 13 sound profiles includes an internal procedural Web Audio API synthesizer, ensuring alerts trigger cleanly even when offline or before files finish downloading.
- **Dual Notification & Click-to-Focus**: Dispatches concise desktop notifications (`Rest!` when focus period completes, `Focus!` when break period ends). Clicking the Windows desktop toast or in-app notice automatically brings Obsidian to the foreground and opens the floating modal UI.

### 📋 Integrated Task Management & Total Removal Option
- **Inline Task Creation**: Create tasks with estimated pomodoros.
- **Auto-Check & Sinking**: Optionally auto-marks tasks as done when estimated pomodoros are reached, and moves finished tasks to the bottom of the list.
- **Zero-Distraction Total Task Removal**: Users who desire a pure, minimalist Pomodoro timer can disable `Enable Tasks` in the Setting modal or Obsidian Settings panel. When toggled off, the entire task section, "+ Add Task" button, inputs, and active task badges are completely unmounted from the DOM.

### 🎨 Native Obsidian Theme Harmony & Fluid Typography
- **Seamless Theme Following**: By default, Pomofocus automatically adopts your active Obsidian theme palette (`--background-secondary`, `--background-primary`, `--interactive-accent`, `--text-normal`).
- **Sidebar-Optimized Layout**: The top utility bar eliminates redundant plugin titles, while countdown text (56px) and controls (38px) are proportioned to fit sidebars effortlessly without horizontal overflow or boxy clunkiness.
- **Custom Color Swatches**: Users can switch between the native Obsidian theme and classic Pomofocus saturated styles (Teal, Green, Blue) anytime via the Setting modal.

### ⚙️ Integrated In-View Settings with Instant Autosave
- **Dedicated Preferences Center**: All timer durations, automation toggles, alert tones, volume levels, repeats, task visibility, and color themes are managed directly through the top-nav **Setting** modal in sidebar, floating modal, and Small Window views.
- **Zero-Friction Live Autosave**: Modifications take effect in real time as values are typed or toggles are clicked, immediately updating the active timer and writing to vault storage without requiring Obsidian restarts.

### 💾 Dedicated Settings Persistence & Update Protection
- **Isolated Outside Plugin Folder**: User settings and task records are saved to an independent persistent file (`.obsidian/fluent-pomofocus.json`, or a custom vault location configured in Settings).
- **Never Lost During Updates**: Because configuration lives outside `.obsidian/plugins/fluent-pomofocus/`, updating, re-installing, or wiping the plugin directory will never reset your timer durations, sound volume, theme, or task history.
- **Automatic Fallback & Migration**: Automatically detects and migrates legacy plugin `data.json` while maintaining dual-write redundancy.
</layer_2_detailed_guide>

---

<layer_3_advanced>
## ⚙️ Layer 3: Advanced Usage & Integration

### 🪟 Floating Window (A1 Floating UI Standard)
- Command `Open Pomofocus in Floating Window` (`open-floating-modal`) opens an in-app overlay (`12px` rounded corners, elevated depth shadow).
- **Adaptive Golden Ratio Scaling**: When `Enable Tasks` is disabled, the window automatically scales to a comfortable widescreen proportion (`640px` width, `auto` height), expanding the timer card to `560px`, typography to `84px`, and vertically centering elements to eliminate empty dead space.
- **Keyboard Ergonomics**:
  - `Escape`: Closes the modal immediately.
  - `Space`: Toggles timer Start / Pause (suppressed when typing in inputs or when the settings modal is active).
  - `Ctrl + Tab` / `Ctrl + Shift + Tab`: Cycles timer modes right / left (`Pomodoro` ↔ `Short Break` ↔ `Long Break`) in capture phase without UI hint clutter, strictly active only while the modal UI is open.
- Integrated `✕` button on the top nav bar enables instant one-click dismissal.

### 🪟 Small Window Physics
- Triggering `Small Window` uses Obsidian's native `openPopoutLeaf` API.
- The window operates as an independent OS-level desktop window (size `480x720`).
- The in-view Setting modal is scoped with absolute container geometry, ensuring it centers correctly within both narrow sidebars (width ~300px) and detached popout windows without being pushed off-screen.
</layer_3_advanced>
