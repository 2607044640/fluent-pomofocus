import { Modal, App } from "obsidian";
import type FluentPomofocusPlugin from "../main";
import PomofocusView from "./PomofocusView.svelte";

export class PomofocusModal extends Modal {
  private component: PomofocusView | null = null;
  private plugin: FluentPomofocusPlugin;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(app: App, plugin: FluentPomofocusPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();

    modalEl.addClass("fluent-pomofocus-modal");

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

      // Space toggles timer start/pause when not in text input
      if (e.code === "Space" || e.key === " ") {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== "input" && activeTag !== "textarea") {
          e.preventDefault();
          this.plugin.timerService.toggle();
        }
      }
    };

    window.addEventListener("keydown", this.keydownHandler, true);
  }

  onClose(): void {
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
