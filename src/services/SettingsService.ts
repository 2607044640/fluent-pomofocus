import { App, Plugin } from "obsidian";
import { PomofocusSettings, DEFAULT_SETTINGS } from "../models/types";

export class SettingsService {
  private app: App;
  private plugin: Plugin;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Determine the effective settings file path within the vault adapter.
   * Defaults to `${configDir}/fluent-pomofocus.json` (e.g. `.obsidian/fluent-pomofocus.json`).
   */
  public getEffectivePath(customPath?: string): string {
    if (customPath && customPath.trim()) {
      return customPath.trim();
    }
    const configDir = this.app.vault.configDir || ".obsidian";
    return `${configDir}/fluent-pomofocus.json`;
  }

  /**
   * Load settings with resilient fallback:
   * 1. Check custom path if configured, else default vault config path (.obsidian/fluent-pomofocus.json).
   * 2. If dedicated file doesn't exist, check legacy plugin data.json via plugin.loadData().
   * 3. Seamlessly migrate legacy data to dedicated file.
   * 4. Merge with DEFAULT_SETTINGS and ensure dual-alarm backward compatibility.
   */
  public async loadSettings(): Promise<PomofocusSettings> {
    const defaultPath = this.getEffectivePath();
    let loaded: Partial<PomofocusSettings> | null = null;
    let loadedFromDedicated = false;

    // 1. Try reading from dedicated persistent file (.obsidian/fluent-pomofocus.json)
    try {
      if (await this.app.vault.adapter.exists(defaultPath)) {
        const content = await this.app.vault.adapter.read(defaultPath);
        if (content && content.trim()) {
          loaded = JSON.parse(content) as Partial<PomofocusSettings>;
          loadedFromDedicated = true;
        }
      }
    } catch (e) {
      console.warn("[Fluent Pomofocus] Failed to read dedicated settings file:", e);
    }

    // 1b. If loaded settings specify a customStoragePath, check if that custom file exists
    if (loaded && loaded.customStoragePath && loaded.customStoragePath.trim()) {
      const customPath = loaded.customStoragePath.trim();
      try {
        if (await this.app.vault.adapter.exists(customPath)) {
          const customContent = await this.app.vault.adapter.read(customPath);
          if (customContent && customContent.trim()) {
            loaded = JSON.parse(customContent) as Partial<PomofocusSettings>;
          }
        }
      } catch (e) {
        console.warn("[Fluent Pomofocus] Failed to read custom settings file:", e);
      }
    }

    // 2. Fallback to legacy plugin data.json (.obsidian/plugins/fluent-pomofocus/data.json)
    if (!loaded) {
      try {
        const legacy = (await this.plugin.loadData()) as Partial<PomofocusSettings> | null;
        if (legacy) {
          loaded = legacy;
          console.log("[Fluent Pomofocus] Migrated legacy plugin data.json to dedicated storage.");
        }
      } catch (e) {
        console.warn("[Fluent Pomofocus] Failed to read legacy plugin data:", e);
      }
    }

    const settings: PomofocusSettings = Object.assign({}, DEFAULT_SETTINGS, loaded);

    // Dual-alarm backward compatibility
    if (loaded && !loaded.focusAlarmSound && loaded.alarmSound) {
      settings.focusAlarmSound = loaded.alarmSound;
    }
    if (loaded && loaded.focusAlarmVolume === undefined && loaded.alarmVolume !== undefined) {
      settings.focusAlarmVolume = loaded.alarmVolume;
    }
    if (loaded && loaded.focusAlarmRepeat === undefined && loaded.alarmRepeat !== undefined) {
      settings.focusAlarmRepeat = loaded.alarmRepeat;
    }

    // Save immediately if not yet in dedicated storage to ensure auto-migration is locked in
    if (!loadedFromDedicated) {
      await this.saveSettings(settings);
    }

    return settings;
  }

  /**
   * Save settings to the dedicated persistent storage file, and mirror to plugin data.json.
   */
  public async saveSettings(settings: PomofocusSettings): Promise<void> {
    const targetPath = this.getEffectivePath(settings.customStoragePath);
    const jsonStr = JSON.stringify(settings, null, 2);

    // 1. Write to target dedicated file
    try {
      // Ensure parent directory exists if using a custom subfolder
      const lastSlash = targetPath.lastIndexOf("/");
      if (lastSlash > 0) {
        const parentDir = targetPath.substring(0, lastSlash);
        if (!(await this.app.vault.adapter.exists(parentDir))) {
          await this.app.vault.adapter.mkdir(parentDir);
        }
      }
      await this.app.vault.adapter.write(targetPath, jsonStr);
    } catch (e) {
      console.error("[Fluent Pomofocus] Failed to write dedicated settings file:", e);
    }

    // If a custom path is used, also update .obsidian/fluent-pomofocus.json so plugin knows where to look
    const defaultPath = this.getEffectivePath();
    if (targetPath !== defaultPath) {
      try {
        await this.app.vault.adapter.write(defaultPath, jsonStr);
      } catch (e) {
        console.error("[Fluent Pomofocus] Failed to sync base settings anchor:", e);
      }
    }

    // 2. Mirror to legacy plugin data.json as safety fallback
    try {
      await this.plugin.saveData(settings);
    } catch (e) {
      console.error("[Fluent Pomofocus] Failed to mirror settings to plugin data.json:", e);
    }
  }
}
