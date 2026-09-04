<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { App } from "obsidian";
  import { PomofocusSettings, TaskItem, TimerMode } from "../models/types";
  import { TimerService, TimerState } from "../services/TimerService";
  import { SoundService } from "../services/SoundService";
  import SettingModal from "./SettingModal.svelte";
  import {
    Settings as SettingsIcon,
    ExternalLink,
    CheckCircle2,
    Plus,
    MoreVertical,
    Trash2,
    SkipForward,
  } from "lucide-svelte";

  export let app: App | undefined = undefined;
  if (app) { /* referenced */ }
  export let settings: PomofocusSettings;
  export let timerService: TimerService;
  export let soundService: SoundService;
  export let onSaveSettings: () => Promise<void>;
  export let onOpenSmallWindow: () => void;

  let timerState: TimerState = timerService.getState();
  let unsubscribeTimer: (() => void) | null = null;

  let showSettingModal: boolean = false;
  let showTaskMenu: boolean = false;
  let isAddingTask: boolean = false;
  let newTaskTitle: string = "";
  let newTaskEst: number = 1;

  onMount(() => {
    unsubscribeTimer = timerService.subscribe((state) => {
      timerState = state;
    });

    timerService.onPomodoroComplete = () => {
      // Increment active task completed pomodoros
      if (settings.activeTaskId) {
        const active = settings.tasks.find((t) => t.id === settings.activeTaskId);
        if (active) {
          active.actPomodoros += 1;
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
  });

  function autofocusAction(node: HTMLElement) {
    node.focus();
  }

  function getThemeBgColor(mode: TimerMode, theme: string, running: boolean, darkMode: boolean): string {
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

  function handleSaveModal(e: CustomEvent<PomofocusSettings>) {
    settings = { ...settings, ...e.detail };
    timerService.updateSettings(settings);
    void onSaveSettings();
  }
</script>

<div
  class="pomo-app-wrapper"
  style="background-color: {getThemeBgColor(timerState.mode, settings.colorTheme, timerState.isRunning, settings.darkModeWhenRunning)}"
>
  <!-- TOP NAV BAR -->
  <header class="pomo-header">
    <div class="pomo-brand">
      <CheckCircle2 size={20} class="pomo-brand-icon" />
      <span class="pomo-brand-name">Pomofocus</span>
    </div>
    <div class="pomo-nav-actions">
      <button class="pomo-btn-nav" on:click={onOpenSmallWindow} title="Open Small Window">
        <ExternalLink size={15} />
        <span class="pomo-btn-text">Small Window</span>
      </button>
      <button class="pomo-btn-nav" on:click={() => (showSettingModal = true)} title="Settings">
        <SettingsIcon size={15} />
        <span class="pomo-btn-text">Setting</span>
      </button>
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
            <SkipForward size={22} />
          </button>
        {/if}
      </div>
    </div>

    <!-- SUBTITLE & ROUND -->
    <div class="pomo-sub-info">
      <div class="pomo-round">#{timerState.round}</div>
      <div class="pomo-status-msg">
        {timerState.mode === "pomodoro" ? "Time to focus!" : "Time for a break!"}
      </div>
    </div>

    <!-- TASKS SECTION -->
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
  </main>

  {#if showSettingModal}
    <SettingModal
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
    min-height: 100%;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    transition: background-color 0.4s ease;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .pomo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }

  .pomo-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.5px;
  }

  .pomo-nav-actions {
    display: flex;
    gap: 8px;
  }

  .pomo-btn-nav {
    background: rgba(255, 255, 255, 0.18);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .pomo-btn-nav:hover {
    background: rgba(255, 255, 255, 0.28);
  }

  .pomo-main-content {
    max-width: 480px;
    width: 100%;
    margin: 0 auto;
    padding: 24px 16px 40px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .pomo-timer-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px 24px 28px 24px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  }

  .pomo-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
  }

  .pomo-tab {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .pomo-tab:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .pomo-tab.active {
    background: rgba(0, 0, 0, 0.18);
    font-weight: 700;
    color: #fff;
  }

  .pomo-time-display {
    font-size: 88px;
    font-weight: 700;
    letter-spacing: 2px;
    line-height: 1;
    margin: 8px 0 24px 0;
    user-select: none;
    font-variant-numeric: tabular-nums;
  }

  .pomo-action-row {
    display: flex;
    align-items: center;
    gap: 14px;
    position: relative;
    width: 100%;
    justify-content: center;
  }

  .pomo-start-btn {
    background: #ffffff;
    color: #225358;
    border: none;
    border-radius: 6px;
    padding: 0 46px;
    height: 52px;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 1px;
    cursor: pointer;
    box-shadow: 0 6px 0 #d9d9d9;
    transition: all 0.1s ease;
  }
  .pomo-start-btn:active {
    transform: translateY(4px);
    box-shadow: 0 2px 0 #d9d9d9;
  }
  .pomo-start-btn.running {
    box-shadow: 0 2px 0 #d9d9d9;
    transform: translateY(4px);
  }

  .pomo-skip-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 6px;
  }
  .pomo-skip-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.15);
  }

  .pomo-sub-info {
    text-align: center;
    margin: 20px 0 24px 0;
  }

  .pomo-round {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.65);
    margin-bottom: 4px;
  }

  .pomo-status-msg {
    font-size: 17px;
    font-weight: 500;
  }

  .pomo-tasks-section {
    width: 100%;
  }

  .pomo-tasks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid rgba(255, 255, 255, 0.3);
    padding-bottom: 12px;
    margin-bottom: 14px;
  }

  .pomo-tasks-title {
    font-size: 17px;
    font-weight: 700;
  }

  .pomo-tasks-menu-wrapper {
    position: relative;
  }

  .pomo-icon-btn-round {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: #fff;
    border-radius: 4px;
    padding: 4px 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  .pomo-icon-btn-round:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .pomo-dropdown-menu {
    position: absolute;
    right: 0;
    top: 30px;
    background: #ffffff;
    color: #333333;
    border-radius: 6px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.25);
    z-index: 50;
    min-width: 160px;
    overflow: hidden;
  }

  .pomo-dropdown-menu button {
    background: transparent;
    border: none;
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px 14px;
    font-size: 13px;
    color: #444;
    cursor: pointer;
  }
  .pomo-dropdown-menu button:hover {
    background: #f0f0f0;
  }

  .pomo-tasks-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
  }

  .pomo-task-item {
    background: #ffffff;
    color: #333333;
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: transform 0.1s;
    border-left: 4px solid transparent;
  }
  .pomo-task-item.active {
    border-left-color: #1d5257;
  }
  .pomo-task-item.completed {
    opacity: 0.65;
  }
  .pomo-task-item.completed .pomo-task-title {
    text-decoration: line-through;
    color: #888;
  }

  .pomo-task-check {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #bbb;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #fff;
    padding: 0;
  }
  .pomo-task-check.checked {
    background: #ba4949;
    border-color: #ba4949;
  }

  .pomo-task-title {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
  }

  .pomo-task-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pomo-pomo-count {
    font-size: 13px;
    color: #888;
    font-weight: 600;
  }

  .pomo-del-task-btn {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    padding: 3px;
  }
  .pomo-del-task-btn:hover {
    color: #e53935;
  }

  .pomo-add-task-dashed {
    background: rgba(0, 0, 0, 0.12);
    border: 2px dashed rgba(255, 255, 255, 0.4);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.85);
    width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .pomo-add-task-dashed:hover {
    background: rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.6);
  }

  .pomo-add-task-card {
    background: #ffffff;
    color: #333333;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .pomo-add-title-input {
    width: 100%;
    border: none;
    outline: none;
    font-size: 16px;
    font-style: italic;
    color: #444;
    padding: 4px 0 12px 0;
  }

  .pomo-est-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #666;
    margin-bottom: 16px;
  }

  .pomo-est-input {
    width: 50px;
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
    text-align: center;
  }

  .pomo-add-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .pomo-btn-cancel {
    background: transparent;
    border: none;
    color: #777;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 12px;
  }
  .pomo-btn-cancel:hover {
    color: #333;
  }

  .pomo-btn-save {
    background: #222;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 7px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .pomo-btn-save:hover {
    background: #444;
  }
</style>
