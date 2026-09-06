import { Modal, App } from "obsidian";
import type FluentPomofocusPlugin from "../main";
import { TimerMode } from "../models/types";
import PomofocusView from "./PomofocusView.svelte";

export class PomofocusModal extends Modal {
  private component: PomofocusView | null = null;
  private plugin: FluentPomofocusPlugin;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private unsubscribeSettings: (() => void) | null = null;

  constructor(app: App, plugin: FluentPomofocusPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();

    modalEl.addClass("fluent-pomofocus-modal");
    modalEl.toggleClass("no-tasks", !this.plugin.settings.enableTasks);

    this.unsubscribeSettings = this.plugin.onSettingsChange((newSettings) => {
      modalEl.toggleClass("no-tasks", !newSettings.enableTasks);
    });

    this.component = new PomofocusView({
      target: contentEl,
      props: {
        app: this.app,
        plugin: this.plugin,
        settings: this.plugin.settings,
        timerService: this.plugin.timerService,
        soundService: this.plugin.soundService,
        onSaveSettings: () => this.plugin.saveSettings(),
        onOpenSmallWindow: () => {
          this.close();
          void this.plugin.openPopoutWindow();
        },
        isModal: true,
        onClose: () => this.close(),
      },
    });

    this.keydownHandler = (e: KeyboardEvent) => {
      // If pressing Escape, allow native modal dismissal or close
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab to switch timer modes (left / right)
      if ((e.ctrlKey || e.metaKey) && (e.key === "Tab" || e.code === "Tab")) {
        const isSettingOpen = !!modalEl.querySelector(".pomo-modal-backdrop");
        if (!isSettingOpen) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.cycleMode(e.shiftKey ? -1 : 1);
          return;
        }
      }

      // Space toggles timer start/pause when not in text input
      if (e.code === "Space" || e.key === " ") {
        const isSettingOpen = !!modalEl.querySelector(".pomo-modal-backdrop");
        if (!isSettingOpen) {
          const activeTag = document.activeElement?.tagName.toLowerCase();
          if (activeTag !== "input" && activeTag !== "textarea") {
            e.preventDefault();
            this.plugin.timerService.toggle();
          }
        }
      }
    };

    window.addEventListener("keydown", this.keydownHandler, true);
  }

  private cycleMode(direction: 1 | -1): void {
    const modes: TimerMode[] = ["pomodoro", "shortBreak", "longBreak"];
    const currentMode = this.plugin.timerService.getState().mode;
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (Math.max(0, currentIndex) + direction + modes.length) % modes.length;
    const nextMode = modes[nextIndex];
    this.plugin.settings.currentMode = nextMode;
    this.plugin.timerService.switchMode(nextMode, false);
    void this.plugin.saveSettings();
  }

  onClose(): void {
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
      this.unsubscribeSettings = null;
    }

    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler, true);
      this.keydownHandler = null;
    }

    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }
}
