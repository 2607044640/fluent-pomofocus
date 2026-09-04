import { Plugin, ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_POMOFOCUS, PomofocusSettings, DEFAULT_SETTINGS } from "./models/types";
import { SoundService } from "./services/SoundService";
import { TimerService } from "./services/TimerService";
import PomofocusView from "./ui/PomofocusView.svelte";
import "./styles.css";

export class PomofocusViewWrapper extends ItemView {
  private component: PomofocusView | null = null;
  private plugin: A1PomofocusPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: A1PomofocusPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_POMOFOCUS;
  }

  getDisplayText(): string {
    return "Pomofocus";
  }

  getIcon(): string {
    return "timer";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    this.component = new PomofocusView({
      target: container,
      props: {
        app: this.app,
        plugin: this.plugin,
        settings: this.plugin.settings,
        timerService: this.plugin.timerService,
        soundService: this.plugin.soundService,
        onSaveSettings: () => this.plugin.saveSettings(),
        onOpenSmallWindow: () => this.plugin.openPopoutWindow(),
      },
    });
  }

  async onClose(): Promise<void> {
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }
}

export default class A1PomofocusPlugin extends Plugin {
  settings: PomofocusSettings = DEFAULT_SETTINGS;
  soundService!: SoundService;
  timerService!: TimerService;
  private settingsListeners: Set<(settings: PomofocusSettings, source?: string) => void> = new Set();

  public onSettingsChange(listener: (settings: PomofocusSettings, source?: string) => void): () => void {
    this.settingsListeners.add(listener);
    return () => {
      this.settingsListeners.delete(listener);
    };
  }

  public async updateAndBroadcastSettings(
    newSettings: Partial<PomofocusSettings>,
    source?: string
  ): Promise<void> {
    Object.assign(this.settings, newSettings);
    await this.saveSettings();
    this.timerService.updateSettings(this.settings);
    for (const listener of this.settingsListeners) {
      try {
        listener(this.settings, source);
      } catch (e) {
        console.error("Error in settings listener:", e);
      }
    }
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.soundService = new SoundService(this.app, this.manifest);
    void this.soundService.preloadAll();
    this.timerService = new TimerService(this.settings, this.soundService);
    this.timerService.onStateChange = () => {
      this.settings.currentMode = this.timerService.getState().mode;
      this.settings.pomodoroRound = this.timerService.getState().round;
      void this.saveSettings();
    };

    this.registerView(
      VIEW_TYPE_POMOFOCUS,
      (leaf) => new PomofocusViewWrapper(leaf, this)
    );

    this.addRibbonIcon("timer", "Pomofocus", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-pomofocus-sidebar",
      name: "Open Pomofocus in Sidebar",
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "open-pomofocus-popout",
      name: "Open Pomofocus in Small Window",
      callback: () => {
        void this.openPopoutWindow();
      },
    });

    this.addCommand({
      id: "toggle-pomofocus-timer",
      name: "Start / Pause Pomofocus Timer",
      callback: () => {
        this.timerService.toggle();
      },
    });
  }

  onunload(): void {
    if (this.timerService) {
      this.timerService.destroy();
    }
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<PomofocusSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_POMOFOCUS);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_POMOFOCUS, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async openPopoutWindow(): Promise<void> {
    const { workspace } = this.app;
    // Check if workspace supports openPopoutLeaf
    const ws = workspace as unknown as {
      openPopoutLeaf?: (options?: { size?: { width: number; height: number } }) => WorkspaceLeaf;
    };
    if (typeof ws.openPopoutLeaf === "function") {
      const leaf = ws.openPopoutLeaf({
        size: { width: 480, height: 720 },
      });
      await leaf.setViewState({ type: VIEW_TYPE_POMOFOCUS, active: true });
    } else {
      await this.activateView();
    }
  }
}
