# A1 Pomofocus

<context>
For underlying architecture specifications, state management, API signatures, and developer recipes, please refer to: [_Architecture.md](file:///c:/ObsidianDev/plugins/A1Pomofocus/_Architecture.md).
</context>

**A1 Pomofocus** brings a complete, lag-free recreation of the popular [Pomofocus.io](https://pomofocus.io) web app directly into Obsidian as a native desktop plugin. It eliminates browser background tab freezing and resetting, provides high-fidelity synthesized system audio chimes, native desktop notifications, and supports independent detached floating mini-windows ("Small Window").

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Obsidian Version](https://img.shields.io/badge/Obsidian-v1.0.0%2B-purple.svg)

---

<layer_1_quick_start>
## 🚀 Layer 1: Quick Start Guide

### 🛠️ Installation & Activation
1. The plugin is linked to your vault via Junction at `C:\ObsidianNote\.obsidian\plugins\A1Pomofocus`.
2. Open Obsidian -> **Settings** -> **Community Plugins** -> Enable **A1 Pomofocus**.
3. Click the timer icon in the left ribbon or run command `Open Pomofocus in Sidebar`.

### 🎮 Primary Controls Cheatsheet
| Action | Shortcut / Interaction | Description |
| :--- | :--- | :--- |
| **Open in Sidebar** | Command: `Open Pomofocus in Sidebar` | Mounts Pomofocus in the right sidebar |
| **Open Small Window** | Top Nav: `Small Window` / Command: `Open Pomofocus in Small Window` | Detaches into an independent floating mini-window |
| **Start / Pause** | Giant Button / Command: `Start / Pause Pomofocus Timer` | Toggles the active countdown |
| **Skip Mode** | Button: `>>` (Next to start button) | Manually advances to next break or pomodoro |
| **Switch Modes** | Tabs: `Pomodoro`, `Short Break`, `Long Break` | Switches period and adapts theme color |
| **Add Task** | Button: `+ Add Task` | Inserts inline task with estimated pomodoro count |
| **Configure Settings** | Top Nav: `Setting` button | Opens in-view preferences with instant live autosave |
</layer_1_quick_start>

---

<layer_2_detailed_guide>
## 📖 Layer 2: Feature Specifications

### ⏱️ Drift-Free Wall-Clock Timer
- **No Background Sleeping**: Traditional browser timers use `setInterval` which gets throttled or killed when tabs lose focus. A1 Pomofocus calculates `targetEndTime - Date.now()`, ensuring absolute precision even through laptop sleep and wake cycles.
- **Three Core Modes**:
  - `Pomodoro`: Focus work period (default 50 mins).
  - `Short Break`: Relax and recharge (default 10 mins).
  - `Long Break`: Extended recovery after a cycle of intervals (default 20 mins every 3 rounds).

### 🔔 Real Sound Library, Loudness Amplification & Notifications
- **Real Audio Effects & Caching**: Supports 5 official high-fidelity Pomofocus sound profiles: `Wood` (木鱼敲击), `Bell` (清脆钟鸣), `Bird` (自然鸟鸣), `Digital` (电子闹铃), and `Kitchen` (机械闹钟). Audio files are automatically downloaded from CDN and cached in vault storage for instant zero-latency playback.
- **200% Loudness Amplification**: Integrated with Web Audio API `GainNode` scaling up to 2.0x alongside a `DynamicsCompressorNode`, ensuring alarm alerts are loud, crisp, and clearly audible even through quiet laptop speakers without distortion or clipping.
- **Synthesizer Fallback**: Built-in multi-harmonic synthesized sound generator ensures alerts trigger instantly even in completely offline environments.
- **Dual Notification**: Dispatches non-intrusive Obsidian in-app toasts alongside Windows desktop notifications.

### 📋 Integrated Task Management
- **Inline Task Creation**: Create tasks with estimated pomodoros.
- **Auto-Check & Sinking**: Optionally auto-marks tasks as done when estimated pomodoros are reached, and moves finished tasks to the bottom of the list.

### ⚙️ Integrated In-View Settings with Instant Autosave
- **Dedicated Preferences Center**: All timer durations, automation toggles, alert tones, volume levels, repeats, and color themes are managed directly through the top-nav **Setting** modal in both sidebar and Small Window views.
- **Zero-Friction Live Autosave**: Modifications take effect in real time as values are typed or toggles are clicked, immediately updating the active timer and writing to vault storage without requiring Obsidian restarts.
</layer_2_detailed_guide>

---

<layer_3_advanced>
## ⚙️ Layer 3: Advanced Usage & Integration

### 🪟 Small Window Physics
- Triggering `Small Window` uses Obsidian's native `openPopoutLeaf` API.
- The window operates as an independent OS-level desktop window (size `480x720`).
- The in-view Setting modal is scoped with absolute container geometry, ensuring it centers correctly within both narrow sidebars (width ~300px) and detached popout windows without being pushed off-screen.
</layer_3_advanced>
