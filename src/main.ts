import { Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, Setting, App } from "obsidian";
import { VIEW_TYPE_POMOFOCUS, PomofocusSettings, DEFAULT_SETTINGS } from "./models/types";
import { SoundService } from "./services/SoundService";
import { TimerService } from "./services/TimerService";
import { SettingsService } from "./services/SettingsService";
import PomofocusView from "./ui/PomofocusView.svelte";
import { PomofocusModal } from "./ui/PomofocusModal";
import "./styles.css";

export class PomofocusViewWrapper extends ItemView {
  private component: PomofocusView | null = null;
  private plugin: FluentPomofocusPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: FluentPomofocusPlugin) {
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

export default class FluentPomofocusPlugin extends Plugin {
  settings: PomofocusSettings = DEFAULT_SETTINGS;
  settingsService!: SettingsService;
  soundService!: SoundService;
  timerService!: TimerService;
  private activeModal: PomofocusModal | null = null;
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
    this.settingsService = new SettingsService(this.app, this);
    this.addSettingTab(new PomofocusSettingTab(this.app, this));

    await this.loadSettings();

    this.soundService = new SoundService(this.app, this.manifest);
    void this.soundService.preloadAll();
    this.timerService = new TimerService(this.settings, this.soundService);
    this.timerService.onStateChange = () => {
      this.settings.currentMode = this.timerService.getState().mode;
      this.settings.pomodoroRound = this.timerService.getState().round;
      void this.saveSettings();
    };
    this.timerService.onNotificationClick = () => {
      this.openFloatingModal();
    };

    this.registerView(
      VIEW_TYPE_POMOFOCUS,
      (leaf) => new PomofocusViewWrapper(leaf, this)
    );

    this.addRibbonIcon("timer", "Pomofocus", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-sidebar",
      name: "Open Pomofocus in Sidebar",
      callback: () => {
        void this.activateView();
      },
    });

    this.addCommand({
      id: "open-small-window",
      name: "Open Pomofocus in Small Window",
      callback: () => {
        void this.openPopoutWindow();
      },
    });

    this.addCommand({
      id: "open-floating-modal",
      name: "Open Pomofocus in Floating Window",
      callback: () => {
        this.openFloatingModal();
      },
    });

    this.addCommand({
      id: "toggle-timer",
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
    this.settings = await this.settingsService.loadSettings();
  }

  async saveSettings(): Promise<void> {
    await this.settingsService.saveSettings(this.settings);
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

  openFloatingModal(): void {
    if (this.activeModal && document.body.contains(this.activeModal.containerEl)) {
      return;
    }
    this.activeModal = new PomofocusModal(this.app, this);
    this.activeModal.open();
  }

  onModalClose(): void {
    this.activeModal = null;
  }
}

export class PomofocusSettingTab extends PluginSettingTab {
  plugin: FluentPomofocusPlugin;

  constructor(app: App, plugin: FluentPomofocusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Tasks")
      .setHeading();

    new Setting(containerEl)
      .setName("Enable tasks")
      .setDesc("Enable or completely remove the task list and task tracking UI below the timer.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.enableTasks)
          .onChange(async (value) => {
            await this.plugin.updateAndBroadcastSettings({ enableTasks: value }, "setting-tab");
          });
      });

    new Setting(containerEl)
      .setName("Sound")
      .setHeading();

    new Setting(containerEl)
      .setName("Focus alarm sound")
      .setDesc("Sound played when a focus session completes.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("wood", "Wood (木块/木鱼)")
          .addOption("bell", "Bell (清脆钟鸣)")
          .addOption("bird", "Bird (自然鸟鸣)")
          .addOption("digital", "Digital (电子闹铃)")
          .addOption("kitchen", "Kitchen (机械闹钟)")
          .addOption("gong", "Gong (禅意铜锣/颂钵)")
          .addOption("chime", "Chime (和弦风铃)")
          .addOption("musicbox", "Music Box (纯净八音盒)")
          .addOption("glass", "Glass (水晶敲击)")
          .addOption("drop", "Water Drop (清泉水滴)")
          .addOption("reception", "Reception Bell (前台叮铃)")
          .addOption("dingdong", "Ding Dong (门铃和弦)")
          .addOption("positive", "Positive (愉悦提示)")
          .addOption("none", "None (静音)")
          .setValue(this.plugin.settings.focusAlarmSound || "wood")
          .onChange(async (val) => {
            await this.plugin.updateAndBroadcastSettings({ focusAlarmSound: val as any, alarmSound: val as any }, "setting-tab");
          });
      });

    new Setting(containerEl)
      .setName("Break alarm sound")
      .setDesc("Sound played when a short or long break completes.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("wood", "Wood (木块/木鱼)")
          .addOption("bell", "Bell (清脆钟鸣)")
          .addOption("bird", "Bird (自然鸟鸣)")
          .addOption("digital", "Digital (电子闹铃)")
          .addOption("kitchen", "Kitchen (机械闹钟)")
          .addOption("gong", "Gong (禅意铜锣/颂钵)")
          .addOption("chime", "Chime (和弦风铃)")
          .addOption("musicbox", "Music Box (纯净八音盒)")
          .addOption("glass", "Glass (水晶敲击)")
          .addOption("drop", "Water Drop (清泉水滴)")
          .addOption("reception", "Reception Bell (前台叮铃)")
          .addOption("dingdong", "Ding Dong (门铃和弦)")
          .addOption("positive", "Positive (愉悦提示)")
          .addOption("none", "None (静音)")
          .setValue(this.plugin.settings.breakAlarmSound || "bell")
          .onChange(async (val) => {
            await this.plugin.updateAndBroadcastSettings({ breakAlarmSound: val as any }, "setting-tab");
          });
      });

    new Setting(containerEl)
      .setName("Storage")
      .setHeading();

    const currentPath = this.plugin.settingsService.getEffectivePath(this.plugin.settings.customStoragePath);

    new Setting(containerEl)
      .setName("Settings file location")
      .setDesc(`Currently active file: ${currentPath}. Saved independently outside the plugin directory to ensure settings and tasks are never wiped during plugin updates.`)
      .addText((text) => {
        text
          .setPlaceholder(this.plugin.settingsService.getEffectivePath())
          .setValue(this.plugin.settings.customStoragePath || "")
          .onChange(async (val) => {
            await this.plugin.updateAndBroadcastSettings({ customStoragePath: val.trim() }, "setting-tab");
          });
      });
  }
}

