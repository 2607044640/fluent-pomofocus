import { App, PluginSettingTab, Setting } from "obsidian";
import type A1PomofocusPlugin from "./main";
import { SoundType } from "./models/types";

export class A1PomofocusSettingTab extends PluginSettingTab {
  plugin: A1PomofocusPlugin;

  constructor(app: App, plugin: A1PomofocusPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Pomofocus Settings").setHeading();

    // ----------------------------------------------------
    // Section: Timer Durations
    // ----------------------------------------------------
    new Setting(containerEl).setName("Timer Durations").setHeading();

    new Setting(containerEl)
      .setName("Pomodoro Time (minutes)")
      .setDesc("Focus duration in minutes")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.pomoTime))
          .onChange(async (val) => {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.pomoTime = num;
              await this.plugin.saveSettings();
              this.plugin.timerService.updateSettings(this.plugin.settings);
            }
          })
      );

    new Setting(containerEl)
      .setName("Short Break Time (minutes)")
      .setDesc("Short break duration in minutes")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.shortBreakTime))
          .onChange(async (val) => {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.shortBreakTime = num;
              await this.plugin.saveSettings();
              this.plugin.timerService.updateSettings(this.plugin.settings);
            }
          })
      );

    new Setting(containerEl)
      .setName("Long Break Time (minutes)")
      .setDesc("Long break duration in minutes")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.longBreakTime))
          .onChange(async (val) => {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.longBreakTime = num;
              await this.plugin.saveSettings();
              this.plugin.timerService.updateSettings(this.plugin.settings);
            }
          })
      );

    new Setting(containerEl)
      .setName("Long Break Interval")
      .setDesc("Number of pomodoros before triggering a long break")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.longBreakInterval))
          .onChange(async (val) => {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.longBreakInterval = num;
              await this.plugin.saveSettings();
              this.plugin.timerService.updateSettings(this.plugin.settings);
            }
          })
      );

    // ----------------------------------------------------
    // Section: Automation
    // ----------------------------------------------------
    new Setting(containerEl).setName("Automation").setHeading();

    new Setting(containerEl)
      .setName("Auto Start Breaks")
      .setDesc("Automatically start the break countdown when a pomodoro finishes")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoStartBreaks)
          .onChange(async (val) => {
            this.plugin.settings.autoStartBreaks = val;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("Auto Start Pomodoros")
      .setDesc("Automatically start the pomodoro countdown when a break finishes")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoStartPomodoros)
          .onChange(async (val) => {
            this.plugin.settings.autoStartPomodoros = val;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );

    // ----------------------------------------------------
    // Section: Tasks
    // ----------------------------------------------------
    new Setting(containerEl).setName("Tasks Behavior").setHeading();

    new Setting(containerEl)
      .setName("Auto Check Tasks")
      .setDesc("Automatically mark a task as completed when actual pomodoros reach estimated pomodoros")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoCheckTasks)
          .onChange(async (val) => {
            this.plugin.settings.autoCheckTasks = val;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("Check to Bottom")
      .setDesc("Move completed tasks to the bottom of the task list")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.checkToBottom)
          .onChange(async (val) => {
            this.plugin.settings.checkToBottom = val;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );

    // ----------------------------------------------------
    // Section: Sound & Notifications
    // ----------------------------------------------------
    new Setting(containerEl).setName("Sound & Notifications").setHeading();

    new Setting(containerEl)
      .setName("Alarm Sound")
      .setDesc("Sound effect played when a period completes")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("wood", "Wood (Temple block / Knock)")
          .addOption("bell", "Bell (Harmonic Chime)")
          .addOption("digital", "Digital (Electronic Beep)")
          .addOption("none", "None (Mute)")
          .setValue(this.plugin.settings.alarmSound)
          .onChange(async (val) => {
            this.plugin.settings.alarmSound = val as SoundType;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Test Sound")
          .setCta()
          .onClick(() => {
            this.plugin.soundService.playSound(
              this.plugin.settings.alarmSound,
              this.plugin.settings.alarmVolume,
              1
            );
          })
      );

    new Setting(containerEl)
      .setName("Alarm Volume")
      .setDesc("Sound volume (0 - 100)")
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(this.plugin.settings.alarmVolume)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.alarmVolume = val;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("Alarm Repeat")
      .setDesc("Number of times the alarm sound repeats (1 - 5)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("1", "1 time")
          .addOption("2", "2 times")
          .addOption("3", "3 times")
          .addOption("4", "4 times")
          .addOption("5", "5 times")
          .setValue(String(this.plugin.settings.alarmRepeat))
          .onChange(async (val) => {
            this.plugin.settings.alarmRepeat = parseInt(val, 10) || 1;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );

    // ----------------------------------------------------
    // Section: Theme & Appearance
    // ----------------------------------------------------
    new Setting(containerEl).setName("Theme & Appearance").setHeading();

    new Setting(containerEl)
      .setName("Color Theme")
      .setDesc("Color palette for pomodoro, short break, and long break")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("teal", "Teal (Default Pomofocus)")
          .addOption("green", "Forest Green")
          .addOption("blue", "Deep Ocean Blue")
          .setValue(this.plugin.settings.colorTheme)
          .onChange(async (val) => {
            this.plugin.settings.colorTheme = val as "teal" | "green" | "blue";
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName("Dark Mode When Running")
      .setDesc("Dim background to dark charcoal when the timer is active")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.darkModeWhenRunning)
          .onChange(async (val) => {
            this.plugin.settings.darkModeWhenRunning = val;
            await this.plugin.saveSettings();
            this.plugin.timerService.updateSettings(this.plugin.settings);
          })
      );
  }
}
