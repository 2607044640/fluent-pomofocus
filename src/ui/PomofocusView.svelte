<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { App } from "obsidian";
  import type FluentPomofocusPlugin from "../main";
  import { PomofocusSettings, TaskItem, TimerMode } from "../models/types";
  import { TimerService, TimerState } from "../services/TimerService";
  import { SoundService } from "../services/SoundService";
  import SettingModal from "./SettingModal.svelte";
  import {
    Settings as SettingsIcon,
    ExternalLink,
    Plus,
    MoreVertical,
    Trash2,
    SkipForward,
    X,
  } from "lucide-svelte";

  export let app: App | undefined = undefined;
  if (app) { /* referenced */ }
  export let plugin: FluentPomofocusPlugin;
  export let settings: PomofocusSettings;
  export let timerService: TimerService;
  export let soundService: SoundService;
  export let onSaveSettings: () => Promise<void>;
  export let onOpenSmallWindow: () => void;
  export let isModal: boolean = false;
  export let onClose: (() => void) | null = null;

  let timerState: TimerState = timerService.getState();
  let unsubscribeTimer: (() => void) | null = null;
  let unsubscribeSettings: (() => void) | null = null;

  let showSettingModal: boolean = false;
  let showTaskMenu: boolean = false;
  let isAddingTask: boolean = false;
  let newTaskTitle: string = "";
  let newTaskEst: number = 1;

  onMount(() => {
    unsubscribeTimer = timerService.subscribe((state) => {
      timerState = state;
    });

    unsubscribeSettings = plugin.onSettingsChange((newSettings) => {
      settings = { ...newSettings };
    });

    timerService.onPomodoroComplete = () => {
      // Increment active task completed pomodoros
      if (settings.enableTasks && settings.activeTaskId) {
        const active = settings.tasks.find((t) => t.id === settings.activeTaskId);
        if (active) {
          active.actPomodoros += 1;
          settings.tasks = [...settings.tasks];
          if (settings.autoCheckTasks && active.actPomodoros >= active.estPomodoros) {
            active.completed = true;
            if (settings.checkToBottom) {
              reorderTasks();
            }
          }
          void onSaveSettings();
        }
      }
    };
  });

  onDestroy(() => {
    if (unsubscribeTimer) {
      unsubscribeTimer();
    }
    if (unsubscribeSettings) {
      unsubscribeSettings();
    }
  });

  function autofocusAction(node: HTMLElement) {
    node.focus();
  }

  function getThemeBgColor(mode: TimerMode, theme: string, running: boolean, darkMode: boolean): string {
    if (theme === "obsidian") {
      return "";
    }
    if (running && darkMode) {
      return "#151719";
    }
    if (theme === "green") {
      if (mode === "pomodoro") return "#285943";
      if (mode === "shortBreak") return "#3b7d62";
      return "#244d5c";
    }
    if (theme === "blue") {
      if (mode === "pomodoro") return "#254868";
      if (mode === "shortBreak") return "#396791";
      return "#233d59";
    }
    // Default teal theme
    if (mode === "pomodoro") return "#225358";
    if (mode === "shortBreak") return "#347880";
    return "#26546e";
  }

  function handleModeChange(mode: TimerMode) {
    settings.currentMode = mode;
    timerService.switchMode(mode, false);
    void onSaveSettings();
  }

  function toggleTimer() {
    timerService.toggle();
  }

  function skipTimer() {
    timerService.skip();
  }

  function addTask() {
    if (!newTaskTitle.trim()) return;
    const task: TaskItem = {
      id: "task_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      title: newTaskTitle.trim(),
      completed: false,
      actPomodoros: 0,
      estPomodoros: Math.max(1, newTaskEst || 1),
      createdAt: Date.now(),
    };
    settings.tasks = [...settings.tasks, task];
    if (!settings.activeTaskId) {
      settings.activeTaskId = task.id;
    }
    newTaskTitle = "";
    newTaskEst = 1;
    isAddingTask = false;
    void onSaveSettings();
  }

  function toggleTaskComplete(task: TaskItem) {
    task.completed = !task.completed;
    if (settings.checkToBottom) {
      reorderTasks();
    }
    void onSaveSettings();
  }

  function reorderTasks() {
    settings.tasks = [
      ...settings.tasks.filter((t) => !t.completed),
      ...settings.tasks.filter((t) => t.completed),
    ];
  }

  function deleteTask(id: string) {
    settings.tasks = settings.tasks.filter((t) => t.id !== id);
    if (settings.activeTaskId === id) {
      settings.activeTaskId = settings.tasks.length > 0 ? settings.tasks[0].id : null;
    }
    void onSaveSettings();
  }

  function selectActiveTask(id: string) {
    settings.activeTaskId = id;
    void onSaveSettings();
  }

  function clearFinishedTasks() {
    settings.tasks = settings.tasks.filter((t) => !t.completed);
    if (settings.activeTaskId && !settings.tasks.some((t) => t.id === settings.activeTaskId)) {
      settings.activeTaskId = settings.tasks.length > 0 ? settings.tasks[0].id : null;
    }
    showTaskMenu = false;
    void onSaveSettings();
  }

  function clearAllTasks() {
    settings.tasks = [];
    settings.activeTaskId = null;
    showTaskMenu = false;
    void onSaveSettings();
  }

  async function handleSaveModal(e: CustomEvent<PomofocusSettings>) {
    await plugin.updateAndBroadcastSettings(e.detail, "modal");
  }

  export function cycleMode(direction: 1 | -1) {
    const modes: TimerMode[] = ["pomodoro", "shortBreak", "longBreak"];
    const currentIndex = modes.indexOf(timerState.mode);
    const nextIndex = (Math.max(0, currentIndex) + direction + modes.length) % modes.length;
    handleModeChange(modes[nextIndex]);
  }

  let wrapperEl: HTMLElement | null = null;

  function openSettingsModal() {
    if (wrapperEl) {
      wrapperEl.scrollTop = 0;
    }
    showSettingModal = true;
  }
</script>

<div
  bind:this={wrapperEl}
  class="pomo-app-wrapper"
  class:theme-obsidian={settings.colorTheme === "obsidian"}
  class:modal-open={showSettingModal}
  class:is-modal={isModal}
  class:no-tasks={!settings.enableTasks}
  style={settings.colorTheme === "obsidian" ? "" : `background-color: ${getThemeBgColor(timerState.mode, settings.colorTheme, timerState.isRunning, settings.darkModeWhenRunning)}`}
>
  <!-- TOP NAV BAR -->
  <header class="pomo-header">
    <div class="pomo-nav-actions">
      <button class="pomo-btn-nav" on:click={onOpenSmallWindow} title="Open in Small Window">
        <ExternalLink size={13} />
        <span class="pomo-btn-text">Small Window</span>
      </button>
      <button class="pomo-btn-nav" on:click={openSettingsModal} title="Settings">
        <SettingsIcon size={13} />
        <span class="pomo-btn-text">Setting</span>
      </button>
      {#if isModal && onClose}
        <button class="pomo-btn-nav pomo-btn-close" on:click={onClose} title="Close (Esc)">
          <X size={13} />
        </button>
      {/if}
    </div>
  </header>

  <!-- MAIN TIMER CARD CONTAINER -->
  <main class="pomo-main-content">
    <div class="pomo-timer-card">
      <!-- MODE TABS -->
      <div class="pomo-tabs">
        <button
          class="pomo-tab"
          class:active={timerState.mode === "pomodoro"}
          on:click={() => handleModeChange("pomodoro")}
        >
          Pomodoro
        </button>
        <button
          class="pomo-tab"
          class:active={timerState.mode === "shortBreak"}
          on:click={() => handleModeChange("shortBreak")}
        >
          Short Break
        </button>
        <button
          class="pomo-tab"
          class:active={timerState.mode === "longBreak"}
          on:click={() => handleModeChange("longBreak")}
        >
          Long Break
        </button>
      </div>

      <!-- TIMER COUNTDOWN DISPLAY -->
      <div class="pomo-time-display">
        {timerState.formattedTime}
      </div>

      <!-- TIMER ACTION BUTTONS -->
      <div class="pomo-action-row">
        <button
          class="pomo-start-btn"
          class:running={timerState.isRunning}
          on:click={toggleTimer}
        >
          {timerState.isRunning ? "PAUSE" : "START"}
        </button>

        {#if timerState.isRunning || timerState.remainingSeconds < timerState.totalSeconds}
          <button class="pomo-skip-btn" on:click={skipTimer} title="Skip to next">
            <SkipForward size={18} />
          </button>
        {/if}
      </div>
    </div>

    <!-- STATUS MESSAGE -->
    <div class="pomo-sub-info">
      <div class="pomo-status-msg">
        {timerState.mode === "pomodoro" ? "Time to focus!" : "Time for a break!"}
      </div>
    </div>

    <!-- TASKS SECTION -->
    {#if settings.enableTasks}
      <section class="pomo-tasks-section">
        <div class="pomo-tasks-header">
          <span class="pomo-tasks-title">Tasks</span>
          <div class="pomo-tasks-menu-wrapper">
            <button class="pomo-icon-btn-round" on:click={() => (showTaskMenu = !showTaskMenu)} title="Task options">
              <MoreVertical size={16} />
            </button>
            {#if showTaskMenu}
              <div class="pomo-dropdown-menu">
                <button on:click={clearFinishedTasks}>Clear finished tasks</button>
                <button on:click={clearAllTasks}>Clear all tasks</button>
              </div>
            {/if}
          </div>
        </div>

        <div class="pomo-tasks-list">
          {#each settings.tasks as task (task.id)}
            <div
              class="pomo-task-item"
              class:completed={task.completed}
              class:active={settings.activeTaskId === task.id}
              on:click={() => selectActiveTask(task.id)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && selectActiveTask(task.id)}
            >
              <button
                class="pomo-task-check"
                class:checked={task.completed}
                on:click|stopPropagation={() => toggleTaskComplete(task)}
                title="Mark complete"
              >
                {#if task.completed}
                  ✓
                {/if}
              </button>

              <span class="pomo-task-title">{task.title}</span>

              <div class="pomo-task-meta">
                <span class="pomo-pomo-count">{task.actPomodoros} / {task.estPomodoros}</span>
                <button
                  class="pomo-del-task-btn"
                  on:click|stopPropagation={() => deleteTask(task.id)}
                  title="Delete task"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          {/each}
        </div>

        {#if !isAddingTask}
          <button class="pomo-add-task-dashed" on:click={() => (isAddingTask = true)}>
            <Plus size={18} />
            <span>Add Task</span>
          </button>
        {:else}
          <div class="pomo-add-task-card">
            <input
              type="text"
              placeholder="What are you working on?"
              class="pomo-add-title-input"
              bind:value={newTaskTitle}
              on:keydown={(e) => e.key === 'Enter' && addTask()}
              use:autofocusAction
            />
            <div class="pomo-est-row">
              <span>Est Pomodoros:</span>
              <input type="number" min="1" max="20" class="pomo-est-input" bind:value={newTaskEst} />
            </div>
            <div class="pomo-add-actions">
              <button class="pomo-btn-cancel" on:click={() => (isAddingTask = false)}>Cancel</button>
              <button class="pomo-btn-save" on:click={addTask}>Save</button>
            </div>
          </div>
        {/if}
      </section>
    {/if}
  </main>

  {#if showSettingModal}
    <SettingModal
      {plugin}
      {settings}
      {soundService}
      {onOpenSmallWindow}
      on:close={() => (showSettingModal = false)}
      on:save={handleSaveModal}
    />
  {/if}
</div>

<style>
  .pomo-app-wrapper {
    position: relative;
    min-height: 100%;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    color: #ffffff;
    font-family: var(--font-interface, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    transition: background-color 0.3s ease;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .pomo-app-wrapper.theme-obsidian {
    background-color: var(--background-secondary);
    color: var(--text-normal);
  }

  .pomo-app-wrapper.modal-open {
    overflow: hidden;
  }

  /* Modal No-Tasks Widescreen Scaling & Proportion */
  .pomo-app-wrapper.no-tasks.is-modal {
    height: auto;
    min-height: 400px;
    justify-content: space-between;
  }

  @media (min-width: 460px) {
    .pomo-app-wrapper.no-tasks .pomo-header {
      max-width: 560px;
      padding: 10px 16px;
    }
    .pomo-app-wrapper.no-tasks .pomo-main-content {
      max-width: 560px;
      flex: 1;
      justify-content: center;
      padding: 18px 20px 28px 20px;
    }
    .pomo-app-wrapper.no-tasks .pomo-timer-card {
      padding: 22px 28px 26px 28px;
      border-radius: 12px;
    }
    .pomo-app-wrapper.no-tasks .pomo-tabs {
      gap: 6px;
      padding: 4px;
      margin-bottom: 12px;
      border-radius: 8px;
    }
    .pomo-app-wrapper.no-tasks .pomo-tab {
      font-size: 14px;
      padding: 6px 18px;
      border-radius: 6px;
    }
    .pomo-app-wrapper.no-tasks .pomo-time-display {
      font-size: 84px;
      margin: 10px 0 20px 0;
      letter-spacing: 2px;
    }
    .pomo-app-wrapper.no-tasks .pomo-start-btn {
      height: 46px;
      padding: 0 44px;
      font-size: 16px;
      border-radius: 8px;
    }
    .pomo-app-wrapper.no-tasks .pomo-status-msg {
      font-size: 15px;
      margin-top: 14px;
    }
  }

  .pomo-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 8px 16px;
    max-width: 440px;
    margin: 0 auto;
    width: 100%;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    box-sizing: border-box;
  }
  .theme-obsidian .pomo-header {
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .pomo-nav-actions {
    display: flex;
    gap: 6px;
  }

  .pomo-btn-nav {
    background: rgba(255, 255, 255, 0.14);
    border: none;
    color: rgba(255, 255, 255, 0.9);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .pomo-btn-nav:hover {
    background: rgba(255, 255, 255, 0.24);
    color: #fff;
  }
  .theme-obsidian .pomo-btn-nav {
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
  }
  .theme-obsidian .pomo-btn-nav:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }
  .pomo-btn-nav.pomo-btn-close {
    padding: 4px 6px;
  }
  .pomo-btn-nav.pomo-btn-close:hover {
    background: var(--background-modifier-error-hover, rgba(235, 87, 87, 0.2)) !important;
    color: var(--text-error, #eb5757) !important;
  }

  .pomo-main-content {
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
    padding: 14px 14px 28px 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
  }

  .pomo-timer-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 14px 16px 18px 16px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    box-sizing: border-box;
  }
  .theme-obsidian .pomo-timer-card {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    box-shadow: var(--shadow-s, 0 2px 8px rgba(0, 0, 0, 0.08));
  }

  .pomo-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
    background: rgba(0, 0, 0, 0.1);
    padding: 3px;
    border-radius: 6px;
  }
  .theme-obsidian .pomo-tabs {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
  }

  .pomo-tab {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
  }
  .pomo-tab:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
  }
  .pomo-tab.active {
    background: rgba(0, 0, 0, 0.22);
    font-weight: 600;
    color: #ffffff;
  }
  .theme-obsidian .pomo-tab {
    color: var(--text-muted);
  }
  .theme-obsidian .pomo-tab:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
  .theme-obsidian .pomo-tab.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
  }

  .pomo-time-display {
    font-size: 56px;
    font-weight: 700;
    letter-spacing: 1px;
    line-height: 1;
    margin: 6px 0 16px 0;
    user-select: none;
    font-variant-numeric: tabular-nums;
  }
  .theme-obsidian .pomo-time-display {
    color: var(--text-normal);
  }

  .pomo-action-row {
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
    width: 100%;
    justify-content: center;
  }

  .pomo-start-btn {
    background: #ffffff;
    color: #225358;
    border: none;
    border-radius: 6px;
    padding: 0 32px;
    height: 38px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transition: all 0.1s ease;
  }
  .pomo-start-btn:active {
    transform: translateY(1px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }
  .theme-obsidian .pomo-start-btn {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
  .theme-obsidian .pomo-start-btn:hover {
    filter: brightness(1.08);
  }
  .theme-obsidian .pomo-start-btn.running {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    box-shadow: none;
  }

  .pomo-skip-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.75);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 4px;
    transition: all 0.15s;
  }
  .pomo-skip-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.15);
  }
  .theme-obsidian .pomo-skip-btn {
    color: var(--text-muted);
  }
  .theme-obsidian .pomo-skip-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .pomo-sub-info {
    text-align: center;
    margin: 10px 0 14px 0;
  }

  .pomo-status-msg {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
  }
  .theme-obsidian .pomo-status-msg {
    color: var(--text-muted);
  }

  .pomo-tasks-section {
    width: 100%;
  }

  .pomo-tasks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .theme-obsidian .pomo-tasks-header {
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .pomo-tasks-title {
    font-size: 14px;
    font-weight: 600;
  }
  .theme-obsidian .pomo-tasks-title {
    color: var(--text-normal);
  }

  .pomo-tasks-menu-wrapper {
    position: relative;
  }

  .pomo-icon-btn-round {
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 3px 5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background 0.15s;
  }
  .pomo-icon-btn-round:hover {
    background: rgba(255, 255, 255, 0.25);
  }
  .theme-obsidian .pomo-icon-btn-round {
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
  }
  .theme-obsidian .pomo-icon-btn-round:hover {
    background: var(--background-modifier-active-hover);
    color: var(--text-normal);
  }

  .pomo-dropdown-menu {
    position: absolute;
    right: 0;
    top: 28px;
    background: #ffffff;
    color: #333333;
    border-radius: 6px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
    z-index: 50;
    min-width: 150px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }
  .theme-obsidian .pomo-dropdown-menu {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    box-shadow: var(--shadow-s, 0 4px 12px rgba(0, 0, 0, 0.3));
  }

  .pomo-dropdown-menu button {
    background: transparent;
    border: none;
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    font-size: 12px;
    color: #444;
    cursor: pointer;
  }
  .pomo-dropdown-menu button:hover {
    background: #f0f0f0;
  }
  .theme-obsidian .pomo-dropdown-menu button {
    color: var(--text-normal);
  }
  .theme-obsidian .pomo-dropdown-menu button:hover {
    background: var(--background-modifier-hover);
  }

  .pomo-tasks-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }

  .pomo-task-item {
    background: #ffffff;
    color: #333333;
    border-radius: 6px;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: transform 0.1s;
    border-left: 3px solid transparent;
  }
  .pomo-task-item.active {
    border-left-color: #1d5257;
  }
  .theme-obsidian .pomo-task-item {
    background: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    box-shadow: none;
  }
  .theme-obsidian .pomo-task-item.active {
    border-left: 3px solid var(--interactive-accent);
    background: var(--background-primary-alt, var(--background-primary));
  }
  .pomo-task-item.completed {
    opacity: 0.6;
  }
  .pomo-task-item.completed .pomo-task-title {
    text-decoration: line-through;
    color: #888;
  }
  .theme-obsidian .pomo-task-item.completed .pomo-task-title {
    color: var(--text-muted);
  }

  .pomo-task-check {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #bbb;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #fff;
    padding: 0;
    flex-shrink: 0;
  }
  .theme-obsidian .pomo-task-check {
    border-color: var(--background-modifier-border, #666);
  }
  .pomo-task-check.checked {
    background: #ba4949;
    border-color: #ba4949;
  }
  .theme-obsidian .pomo-task-check.checked {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }

  .pomo-task-title {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }

  .pomo-task-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pomo-pomo-count {
    font-size: 12px;
    color: #888;
    font-weight: 600;
  }
  .theme-obsidian .pomo-pomo-count {
    color: var(--text-muted);
  }

  .pomo-del-task-btn {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
  }
  .pomo-del-task-btn:hover {
    color: #e53935;
  }

  .pomo-add-task-dashed {
    background: rgba(0, 0, 0, 0.08);
    border: 1px dashed rgba(255, 255, 255, 0.35);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.85);
    width: 100%;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .pomo-add-task-dashed:hover {
    background: rgba(0, 0, 0, 0.15);
    border-color: rgba(255, 255, 255, 0.5);
  }
  .theme-obsidian .pomo-add-task-dashed {
    background: transparent;
    border: 1px dashed var(--background-modifier-border);
    color: var(--text-muted);
  }
  .theme-obsidian .pomo-add-task-dashed:hover {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .pomo-add-task-card {
    background: #ffffff;
    color: #333333;
    border-radius: 6px;
    padding: 12px 14px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
  }
  .theme-obsidian .pomo-add-task-card {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    box-shadow: var(--shadow-s, 0 2px 8px rgba(0,0,0,0.1));
  }

  .pomo-add-title-input {
    width: 100%;
    border: none;
    outline: none;
    font-size: 14px;
    font-style: normal;
    color: #444;
    padding: 2px 0 8px 0;
  }
  .theme-obsidian .pomo-add-title-input {
    background: transparent;
    color: var(--text-normal);
  }

  .pomo-est-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #666;
    margin-bottom: 12px;
  }
  .theme-obsidian .pomo-est-row {
    color: var(--text-muted);
  }

  .pomo-est-input {
    width: 44px;
    padding: 3px 5px;
    border: 1px solid #ccc;
    border-radius: 4px;
    text-align: center;
    font-size: 12px;
  }
  .theme-obsidian .pomo-est-input {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
  }

  .pomo-add-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .pomo-btn-cancel {
    background: transparent;
    border: none;
    color: #777;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    padding: 5px 10px;
  }
  .theme-obsidian .pomo-btn-cancel {
    color: var(--text-muted);
  }
  .theme-obsidian .pomo-btn-cancel:hover {
    color: var(--text-normal);
  }

  .pomo-btn-save {
    background: #222;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 5px 14px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .theme-obsidian .pomo-btn-save {
    background: var(--interactive-accent);
    color: var(--text-on-accent, #ffffff);
  }
</style>
