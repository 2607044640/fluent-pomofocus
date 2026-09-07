<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import type FluentPomofocusPlugin from "../main";
  import { PomofocusSettings, SoundType } from "../models/types";
  import { SoundService } from "../services/SoundService";
  import { X, Volume2, ExternalLink } from "lucide-svelte";

  export let plugin: FluentPomofocusPlugin;
  export let settings: PomofocusSettings;
  export let soundService: SoundService;
  export let onOpenSmallWindow: () => void;

  const dispatch = createEventDispatcher<{
    close: void;
    save: PomofocusSettings;
  }>();

  // Local copy to edit - initialized once on mount
  let localSettings: PomofocusSettings = JSON.parse(JSON.stringify(settings));

  let debounceTimer: number | null = null;

  function sanitize(s: PomofocusSettings): PomofocusSettings {
    const focusVol = Math.min(100, Math.max(0, Number(s.focusAlarmVolume ?? s.alarmVolume) ?? 80));
    const focusRep = Math.max(1, Math.min(10, Number(s.focusAlarmRepeat ?? s.alarmRepeat) || 1));
    const breakVol = Math.min(100, Math.max(0, Number(s.breakAlarmVolume ?? s.alarmVolume) ?? 80));
    const breakRep = Math.max(1, Math.min(10, Number(s.breakAlarmRepeat ?? s.alarmRepeat) || 1));
    return {
      ...s,
      pomoTime: Math.max(1, Number(s.pomoTime) || 1),
      shortBreakTime: Math.max(1, Number(s.shortBreakTime) || 1),
      longBreakTime: Math.max(1, Number(s.longBreakTime) || 1),
      longBreakInterval: Math.max(1, Number(s.longBreakInterval) || 1),
      alarmVolume: focusVol,
      alarmRepeat: focusRep,
      focusAlarmSound: s.focusAlarmSound || s.alarmSound || "wood",
      focusAlarmVolume: focusVol,
      focusAlarmRepeat: focusRep,
      breakAlarmSound: s.breakAlarmSound || "bell",
      breakAlarmVolume: breakVol,
      breakAlarmRepeat: breakRep,
    };
  }

  function syncChanges(immediate: boolean = false) {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const cleaned = sanitize(localSettings);
    if (immediate) {
      void plugin.updateAndBroadcastSettings(cleaned, "modal");
    } else {
      debounceTimer = window.setTimeout(() => {
        void plugin.updateAndBroadcastSettings(cleaned, "modal");
        debounceTimer = null;
      }, 200);
    }
  }

  onMount(() => {
    // If settings change in Obsidian Settings tab while modal is open, reflect them live
    const unsubscribe = plugin.onSettingsChange((newSettings, source) => {
      if (source !== "modal") {
        localSettings = { ...newSettings };
      }
    });

    return () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      unsubscribe();
    };
  });

  function handleSave() {
    soundService.stopSound();
    syncChanges(true);
    dispatch("save", sanitize(localSettings));
    dispatch("close");
  }

  function handleClose() {
    soundService.stopSound();
    syncChanges(true);
    dispatch("close");
  }

  function testSound(target: "focus" | "break", forcePlay: boolean = false) {
    if (!forcePlay && soundService.isPlaying()) {
      soundService.stopSound();
      return;
    }
    if (target === "focus") {
      const rep = Math.max(1, Math.min(Number(localSettings.focusAlarmRepeat ?? localSettings.alarmRepeat) || 1, 10));
      const sound = localSettings.focusAlarmSound || localSettings.alarmSound || "wood";
      const vol = localSettings.focusAlarmVolume ?? localSettings.alarmVolume ?? 80;
      void soundService.playSound(sound, vol, rep);
    } else {
      const rep = Math.max(1, Math.min(Number(localSettings.breakAlarmRepeat) || 1, 10));
      const sound = localSettings.breakAlarmSound || "bell";
      const vol = localSettings.breakAlarmVolume ?? 80;
      void soundService.playSound(sound, vol, rep);
    }
  }
</script>

<div class="pomo-modal-backdrop" on:click|self={handleClose} on:keydown|self={(e) => e.key === 'Escape' && handleClose()} role="presentation">
  <div class="pomo-modal-content" role="dialog" aria-modal="true">
    <div class="pomo-modal-header">
      <span class="pomo-modal-title">SETTING</span>
      <button class="pomo-icon-btn" on:click={handleClose} title="Close">
        <X size={18} />
      </button>
    </div>

    <div class="pomo-modal-body">
      <!-- TIMER SECTION -->
      <div class="pomo-section">
        <div class="pomo-section-title">⏱ TIMER</div>
        <div class="pomo-row-label">Time (minutes)</div>
        <div class="pomo-time-inputs">
          <div class="pomo-time-col">
            <label for="pomo-time-input">Pomodoro</label>
            <input
              id="pomo-time-input"
              type="number"
              min="1"
              max="180"
              bind:value={localSettings.pomoTime}
              on:input={() => syncChanges(false)}
              on:change={() => syncChanges(true)}
            />
          </div>
          <div class="pomo-time-col">
            <label for="short-break-input">Short Break</label>
            <input
              id="short-break-input"
              type="number"
              min="1"
              max="60"
              bind:value={localSettings.shortBreakTime}
              on:input={() => syncChanges(false)}
              on:change={() => syncChanges(true)}
            />
          </div>
          <div class="pomo-time-col">
            <label for="long-break-input">Long Break</label>
            <input
              id="long-break-input"
              type="number"
              min="1"
              max="60"
              bind:value={localSettings.longBreakTime}
              on:input={() => syncChanges(false)}
              on:change={() => syncChanges(true)}
            />
          </div>
        </div>

        <div class="pomo-switch-row">
          <span>Auto Start Breaks</span>
          <input
            type="checkbox"
            class="pomo-toggle"
            bind:checked={localSettings.autoStartBreaks}
            on:change={() => syncChanges(true)}
          />
        </div>

        <div class="pomo-switch-row">
          <span>Auto Start Pomodoros</span>
          <input
            type="checkbox"
            class="pomo-toggle"
            bind:checked={localSettings.autoStartPomodoros}
            on:change={() => syncChanges(true)}
          />
        </div>

        <div class="pomo-input-row">
          <span>Long Break interval</span>
          <input
            type="number"
            min="1"
            max="12"
            class="pomo-num-input"
            bind:value={localSettings.longBreakInterval}
            on:input={() => syncChanges(false)}
            on:change={() => syncChanges(true)}
          />
        </div>
      </div>

      <div class="pomo-divider"></div>

      <!-- TASK SECTION -->
      <div class="pomo-section">
        <div class="pomo-section-title">☑ TASK</div>
        <div class="pomo-switch-row">
          <span>Enable Tasks (启用任务清单)</span>
          <input
            type="checkbox"
            class="pomo-toggle"
            bind:checked={localSettings.enableTasks}
            on:change={() => syncChanges(true)}
          />
        </div>
        {#if localSettings.enableTasks}
          <div class="pomo-switch-row">
            <span>Auto Check Tasks</span>
            <input
              type="checkbox"
              class="pomo-toggle"
              bind:checked={localSettings.autoCheckTasks}
              on:change={() => syncChanges(true)}
            />
          </div>
          <div class="pomo-switch-row">
            <span>Check to Bottom</span>
            <input
              type="checkbox"
              class="pomo-toggle"
              bind:checked={localSettings.checkToBottom}
              on:change={() => syncChanges(true)}
            />
          </div>
        {/if}
      </div>

      <div class="pomo-divider"></div>

      <!-- SOUND SECTION -->
      <div class="pomo-section">
        <div class="pomo-section-title">🔊 SOUND</div>

        <!-- FOCUS SOUND SET -->
        <div class="pomo-sound-group">
          <div class="pomo-group-label">Focus Alarm (专注结束)</div>
          <div class="pomo-select-row">
            <span>Sound</span>
            <div class="pomo-sound-controls">
              <select
                bind:value={localSettings.focusAlarmSound}
                on:change={() => {
                  localSettings.alarmSound = localSettings.focusAlarmSound;
                  syncChanges(true);
                  testSound("focus", true);
                }}
              >
                <option value="wood">Wood (木块/木鱼)</option>
                <option value="bell">Bell (清脆钟鸣)</option>
                <option value="bird">Bird (自然鸟鸣)</option>
                <option value="digital">Digital (电子闹铃)</option>
                <option value="kitchen">Kitchen (机械闹钟)</option>
                <option value="none">None (静音)</option>
              </select>
              <button class="pomo-test-sound-btn" on:click={() => testSound("focus", false)} title="Test Focus Sound">
                <Volume2 size={16} />
              </button>
            </div>
          </div>

          <div class="pomo-slider-row">
            <span class="pomo-slider-val">{localSettings.focusAlarmVolume}%</span>
            <input
              type="range"
              min="0"
              max="100"
              bind:value={localSettings.focusAlarmVolume}
              on:input={() => syncChanges(false)}
              on:change={() => {
                localSettings.alarmVolume = localSettings.focusAlarmVolume;
                syncChanges(true);
                testSound("focus", true);
              }}
            />
          </div>

          <div class="pomo-input-row">
            <span>repeat</span>
            <input
              type="number"
              min="1"
              max="10"
              class="pomo-num-input"
              bind:value={localSettings.focusAlarmRepeat}
              on:input={() => syncChanges(false)}
              on:change={() => {
                localSettings.alarmRepeat = localSettings.focusAlarmRepeat;
                syncChanges(true);
                testSound("focus", true);
              }}
            />
          </div>
        </div>

        <!-- BREAK SOUND SET -->
        <div class="pomo-sound-group" style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.08);">
          <div class="pomo-group-label">Break Alarm (休息结束)</div>
          <div class="pomo-select-row">
            <span>Sound</span>
            <div class="pomo-sound-controls">
              <select
                bind:value={localSettings.breakAlarmSound}
                on:change={() => {
                  syncChanges(true);
                  testSound("break", true);
                }}
              >
                <option value="wood">Wood (木块/木鱼)</option>
                <option value="bell">Bell (清脆钟鸣)</option>
                <option value="bird">Bird (自然鸟鸣)</option>
                <option value="digital">Digital (电子闹铃)</option>
                <option value="kitchen">Kitchen (机械闹钟)</option>
                <option value="none">None (静音)</option>
              </select>
              <button class="pomo-test-sound-btn" on:click={() => testSound("break", false)} title="Test Break Sound">
                <Volume2 size={16} />
              </button>
            </div>
          </div>

          <div class="pomo-slider-row">
            <span class="pomo-slider-val">{localSettings.breakAlarmVolume}%</span>
            <input
              type="range"
              min="0"
              max="100"
              bind:value={localSettings.breakAlarmVolume}
              on:input={() => syncChanges(false)}
              on:change={() => {
                syncChanges(true);
                testSound("break", true);
              }}
            />
          </div>

          <div class="pomo-input-row">
            <span>repeat</span>
            <input
              type="number"
              min="1"
              max="10"
              class="pomo-num-input"
              bind:value={localSettings.breakAlarmRepeat}
              on:input={() => syncChanges(false)}
              on:change={() => {
                syncChanges(true);
                testSound("break", true);
              }}
            />
          </div>
        </div>
      </div>

      <div class="pomo-divider"></div>

      <!-- THEME SECTION -->
      <div class="pomo-section">
        <div class="pomo-section-title">🎨 THEME</div>
        <div class="pomo-theme-swatches">
          <span>Color Themes</span>
          <div class="pomo-swatches">
                        <button
              class="pomo-swatch obsidian"
              class:selected={localSettings.colorTheme === "obsidian"}
              on:click={() => { localSettings.colorTheme = "obsidian"; syncChanges(true); }}
              aria-label="Obsidian Theme"
              title="跟随 Obsidian 主题"
            ></button>
            <button
              class="pomo-swatch teal"
              class:selected={localSettings.colorTheme === "teal"}
              on:click={() => { localSettings.colorTheme = "teal"; syncChanges(true); }}
              aria-label="Teal Theme"
            ></button>
            <button
              class="pomo-swatch green"
              class:selected={localSettings.colorTheme === "green"}
              on:click={() => { localSettings.colorTheme = "green"; syncChanges(true); }}
              aria-label="Green Theme"
            ></button>
            <button
              class="pomo-swatch blue"
              class:selected={localSettings.colorTheme === "blue"}
              on:click={() => { localSettings.colorTheme = "blue"; syncChanges(true); }}
              aria-label="Blue Theme"
            ></button>
          </div>
        </div>

        <div class="pomo-switch-row">
          <span>Dark Mode when running</span>
          <input
            type="checkbox"
            class="pomo-toggle"
            bind:checked={localSettings.darkModeWhenRunning}
            on:change={() => syncChanges(true)}
          />
        </div>

        <div class="pomo-switch-row">
          <span>Small Window</span>
          <button class="pomo-open-window-btn" on:click={() => { onOpenSmallWindow(); handleClose(); }}>
            Open <ExternalLink size={14} />
          </button>
        </div>
      </div>

      <div class="pomo-divider"></div>

      <!-- STORAGE SECTION -->
      <div class="pomo-section">
        <div class="pomo-section-title">💾 STORAGE</div>
        <div class="pomo-storage-row">
          <span class="pomo-storage-desc">Settings File (配置与任务单独保存，插件更新不丢失):</span>
          <span class="pomo-storage-path">{plugin.settingsService ? plugin.settingsService.getEffectivePath(localSettings.customStoragePath) : ".obsidian/fluent-pomofocus.json"}</span>
        </div>
      </div>
    </div>

    <div class="pomo-modal-footer">
      <button class="pomo-ok-btn" on:click={handleSave}>OK</button>
    </div>
  </div>
</div>

<style>
  .pomo-modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.72);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    box-sizing: border-box;
  }

  .pomo-modal-content {
    position: relative;
    z-index: 1001;
    pointer-events: auto;
    user-select: text;
    -webkit-user-select: text;
    background: #1e2022;
    color: #e6e6e6;
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    max-height: 92%;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-family: inherit;
    animation: pomoPopIn 0.18s ease-out;
    box-sizing: border-box;
    overflow: hidden;
  }

  @keyframes pomoPopIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .pomo-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .pomo-modal-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #999;
  }

  .pomo-icon-btn {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 4px;
    pointer-events: auto;
  }
  .pomo-icon-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .pomo-modal-body {
    padding: 16px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .pomo-section-title {
    font-size: 13px;
    font-weight: 700;
    color: #aaa;
    margin-bottom: 10px;
    letter-spacing: 0.5px;
  }

  .pomo-row-label {
    font-size: 13px;
    color: #ddd;
    margin-bottom: 8px;
  }

  .pomo-time-inputs {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .pomo-time-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pomo-time-col label {
    font-size: 11px;
    color: #888;
  }

  .pomo-time-col input {
    background: #2b2e31;
    border: 1px solid #3c4043;
    color: #fff;
    border-radius: 6px;
    padding: 8px 6px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    user-select: text;
    -webkit-user-select: text;
    pointer-events: auto;
    cursor: text;
  }

  .pomo-switch-row,
  .pomo-input-row,
  .pomo-select-row,
  .pomo-theme-swatches {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
    color: #ccc;
  }

  .pomo-num-input {
    background: #2b2e31;
    border: 1px solid #3c4043;
    color: #fff;
    border-radius: 6px;
    padding: 6px 8px;
    width: 60px;
    text-align: center;
    font-size: 13px;
    user-select: text;
    -webkit-user-select: text;
    pointer-events: auto;
    cursor: text;
  }

  .pomo-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 4px 0;
  }

  .pomo-storage-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0;
  }

  .pomo-storage-desc {
    font-size: 11px;
    color: #888;
  }

  .pomo-storage-path {
    font-size: 11px;
    color: #aaa;
    font-family: var(--font-monospace, monospace);
    background: rgba(255, 255, 255, 0.05);
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    word-break: break-all;
    user-select: text;
    -webkit-user-select: text;
  }

  .pomo-group-label {
    font-size: 12px;
    font-weight: 600;
    color: #92a4ad;
    margin-bottom: 6px;
  }

  .pomo-sound-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pomo-sound-controls select {
    background: #2b2e31;
    border: 1px solid #3c4043;
    color: #fff;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 13px;
  }

  .pomo-test-sound-btn {
    background: #2b2e31;
    border: 1px solid #3c4043;
    color: #aaa;
    border-radius: 6px;
    padding: 5px 7px;
    cursor: pointer;
    display: flex;
    align-items: center;
    pointer-events: auto;
  }
  .pomo-test-sound-btn:hover {
    color: #fff;
    background: #3c4043;
  }

  .pomo-slider-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0 8px 0;
  }

  .pomo-slider-val {
    font-size: 12px;
    color: #888;
    width: 38px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .pomo-slider-row input[type="range"] {
    flex: 1;
    accent-color: #4a9388;
    pointer-events: auto;
  }

  .pomo-swatches {
    display: flex;
    gap: 8px;
  }

  .pomo-swatch {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    pointer-events: auto;
  }
  .pomo-swatch.obsidian {
    background: var(--interactive-accent, #7c3aed);
    border: 2px solid var(--background-modifier-border, #444);
  }
  .pomo-swatch.teal { background: #265559; }
  .pomo-swatch.green { background: #356859; }
  .pomo-swatch.blue { background: #2f5674; }
  .pomo-swatch.selected {
    border-color: #fff;
    box-shadow: 0 0 4px #fff;
  }

  .pomo-open-window-btn {
    background: #2b2e31;
    border: 1px solid #3c4043;
    color: #ccc;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    pointer-events: auto;
  }
  .pomo-open-window-btn:hover {
    color: #fff;
    background: #3c4043;
  }

  .pomo-modal-footer {
    padding: 14px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: flex-end;
  }

  .pomo-ok-btn {
    background: #44494d;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 22px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    pointer-events: auto;
  }
  .pomo-ok-btn:hover {
    background: #555b60;
  }

  .pomo-toggle {
    appearance: none;
    -webkit-appearance: none;
    width: 36px;
    height: 20px;
    background: #3c4043;
    border-radius: 20px;
    position: relative;
    cursor: pointer;
    outline: none;
    transition: background 0.2s;
    pointer-events: auto;
  }
  .pomo-toggle::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .pomo-toggle:checked {
    background: #5ea06c;
  }
  .pomo-toggle:checked::after {
    transform: translateX(16px);
  }
</style>
