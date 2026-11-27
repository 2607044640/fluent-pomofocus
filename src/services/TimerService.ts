import { PomofocusSettings, TimerMode } from "../models/types";
import { SoundService } from "./SoundService";
import { NotificationService } from "./NotificationService";

export interface TimerState {
  mode: TimerMode;
  isRunning: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  round: number;
  formattedTime: string;
  autoPaused: boolean;
}

interface ElectronPowerMonitor {
  getSystemIdleTime?: () => number;
}

interface ElectronApi {
  powerMonitor?: ElectronPowerMonitor;
  remote?: {
    powerMonitor?: ElectronPowerMonitor;
  };
}

type Listener = (state: TimerState) => void;

export class TimerService {
  private settings: PomofocusSettings;
  private soundService: SoundService;
  private listeners: Set<Listener> = new Set();

  private mode: TimerMode = "pomodoro";
  private isRunning: boolean = false;
  private remainingSeconds: number = 50 * 60;
  private totalSeconds: number = 50 * 60;
  private round: number = 1;
  private targetEndTime: number = 0;
  private intervalId: number | null = null;
  private autoPaused: boolean = false;
  private lastUserActivityAt: number = Date.now();
  private fallbackActivityHandler: (() => void) | null = null;

  // Callback when a pomodoro completes (to increment active task count)
  public onPomodoroComplete?: () => void;
  // Callback when state should be saved
  public onStateChange?: () => void;
  // Callback when notification is clicked
  public onNotificationClick?: () => void;

  constructor(settings: PomofocusSettings, soundService: SoundService) {
    this.settings = settings;
    this.soundService = soundService;
    this.mode = settings.currentMode || "pomodoro";
    this.round = settings.pomodoroRound || 1;
    this.initDurationForMode(this.mode);
    if (this.getSystemIdleSeconds() === null && typeof window !== "undefined") {
      this.fallbackActivityHandler = () => {
        if (this.isRunning) {
          this.lastUserActivityAt = Date.now();
        }
      };
      window.addEventListener("pointerdown", this.fallbackActivityHandler, { passive: true, capture: true });
      window.addEventListener("keydown", this.fallbackActivityHandler, { passive: true, capture: true });
      window.addEventListener("wheel", this.fallbackActivityHandler, { passive: true, capture: true });
      window.addEventListener("touchstart", this.fallbackActivityHandler, { passive: true, capture: true });
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  private emitStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }

  public recordUserActivity(): void {
    this.lastUserActivityAt = Date.now();
    if (this.autoPaused) {
      this.autoPaused = false;
      this.notify();
    }
  }

  private getSystemIdleSeconds(): number | null {
    try {
      const winWithReq = window as unknown as { require?: (mod: string) => unknown };
      const req: ((mod: string) => unknown) | null =
        typeof winWithReq.require === "function"
          ? winWithReq.require
          : typeof require === "function"
            ? (require as (mod: string) => unknown)
            : null;
      if (!req) return null;

      const electron = req("electron") as ElectronApi | undefined;
      let powerMonitor = electron?.powerMonitor || electron?.remote?.powerMonitor;
      if (!powerMonitor) {
        try {
          const remoteMod = req("@electron/remote") as { powerMonitor?: ElectronPowerMonitor } | undefined;
          powerMonitor = remoteMod?.powerMonitor;
        } catch {
          // @electron/remote may not be exposed
        }
      }

      if (typeof powerMonitor?.getSystemIdleTime === "function") {
        const idleSec = powerMonitor.getSystemIdleTime();
        if (typeof idleSec === "number" && Number.isFinite(idleSec) && idleSec >= 0) {
          return idleSec;
        }
      }
    } catch {
      // Fallback to window activity listeners when Electron powerMonitor is unavailable
    }
    return null;
  }

  private getIdleSeconds(): number {
    const sinceUserControlSec = Math.max(0, Math.floor((Date.now() - this.lastUserActivityAt) / 1000));
    const systemIdleSec = this.getSystemIdleSeconds();
    if (systemIdleSec !== null) {
      return Math.min(systemIdleSec, sinceUserControlSec);
    }
    return sinceUserControlSec;
  }

  private getAutoPauseThresholdMinutes(): number {
    return Math.max(1, Math.min(720, Math.round(Number(this.settings.autoPauseMinutes) || 30)));
  }

  private shouldAutoPause(): boolean {
    if (!this.isRunning || !this.settings.autoPauseEnabled) return false;
    return this.getIdleSeconds() >= this.getAutoPauseThresholdMinutes() * 60;
  }

  private triggerAutoPause(): void {
    this.soundService.stopSound();
    this.pause(true);
    const mins = this.getAutoPauseThresholdMinutes();
    NotificationService.notice(`Pomofocus auto-paused after ${mins}m idle`);
  }

  public getState(): TimerState {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    return {
      mode: this.mode,
      isRunning: this.isRunning,
      remainingSeconds: this.remainingSeconds,
      totalSeconds: this.totalSeconds,
      round: this.round,
      formattedTime,
      autoPaused: this.autoPaused,
    };
  }

  public updateSettings(newSettings: PomofocusSettings): void {
    this.settings = newSettings;
    if (!newSettings.autoPauseEnabled) {
      this.autoPaused = false;
    }
    if (!this.isRunning) {
      const nextTotalSeconds = this.getDurationMinutesForMode(this.mode) * 60;
      if (nextTotalSeconds !== this.totalSeconds) {
        this.totalSeconds = nextTotalSeconds;
        this.remainingSeconds = nextTotalSeconds;
      }
      this.notify();
    }
  }

  private getDurationMinutesForMode(mode: TimerMode): number {
    switch (mode) {
      case "pomodoro":
        return this.settings.pomoTime;
      case "shortBreak":
        return this.settings.shortBreakTime;
      case "longBreak":
        return this.settings.longBreakTime;
    }
  }

  private initDurationForMode(mode: TimerMode): void {
    const mins = this.getDurationMinutesForMode(mode);
    this.totalSeconds = mins * 60;
    this.remainingSeconds = this.totalSeconds;
  }

  public switchMode(targetMode: TimerMode, autoStart: boolean = false, isAutoAdvance: boolean = false): void {
    if (!isAutoAdvance) {
      this.lastUserActivityAt = Date.now();
    }
    this.autoPaused = false;
    this.pause();
    this.mode = targetMode;
    this.initDurationForMode(targetMode);
    if (autoStart) {
      this.start(isAutoAdvance);
    } else {
      this.notify();
    }
    this.emitStateChange();
  }

  public start(isAutoStart: boolean = false): void {
    if (this.isRunning) return;
    if (!isAutoStart) {
      this.lastUserActivityAt = Date.now();
    }
    this.autoPaused = false;
    if (this.remainingSeconds <= 0) {
      this.initDurationForMode(this.mode);
    }

    NotificationService.requestPermissionIfNeeded();

    this.isRunning = true;
    this.targetEndTime = Date.now() + this.remainingSeconds * 1000;

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
    }

    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 200);

    this.notify();
  }

  public pause(triggeredByAutoPause: boolean = false): void {
    this.autoPaused = triggeredByAutoPause;
    if (!this.isRunning) {
      if (triggeredByAutoPause) {
        this.notify();
      }
      return;
    }
    this.isRunning = false;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Lock in current remaining seconds based on exact time difference
    this.remainingSeconds = Math.max(0, Math.round((this.targetEndTime - Date.now()) / 1000));
    this.notify();
  }

  public toggle(): void {
    if (this.isRunning) {
      this.recordUserActivity();
      this.pause();
    } else {
      this.start(false);
    }
  }

  public reset(): void {
    this.lastUserActivityAt = Date.now();
    this.autoPaused = false;
    this.pause();
    this.initDurationForMode(this.mode);
    this.notify();
    this.emitStateChange();
  }

  public skip(): void {
    this.lastUserActivityAt = Date.now();
    this.autoPaused = false;
    this.completeCurrentPeriod(false);
  }

  private tick(): void {
    if (this.shouldAutoPause()) {
      this.triggerAutoPause();
      return;
    }

    const diffMs = this.targetEndTime - Date.now();
    const remaining = Math.max(0, Math.round(diffMs / 1000));

    if (remaining !== this.remainingSeconds) {
      this.remainingSeconds = remaining;
      this.notify();
    }

    if (remaining <= 0) {
      this.completeCurrentPeriod(true);
    }
  }

  private completeCurrentPeriod(playAlert: boolean): void {
    this.pause();
    this.remainingSeconds = 0;

    const completedMode = this.mode;

    if (playAlert) {
      const isFocus = completedMode === "pomodoro";
      const soundType = isFocus
        ? (this.settings.focusAlarmSound || this.settings.alarmSound || "wood")
        : (this.settings.breakAlarmSound || this.settings.alarmSound || "bell");
      const volume = isFocus
        ? (this.settings.focusAlarmVolume ?? this.settings.alarmVolume ?? 80)
        : (this.settings.breakAlarmVolume ?? this.settings.alarmVolume ?? 80);
      const repeat = isFocus
        ? (this.settings.focusAlarmRepeat ?? this.settings.alarmRepeat ?? 2)
        : (this.settings.breakAlarmRepeat ?? this.settings.alarmRepeat ?? 2);

      void this.soundService.playSound(soundType, volume, repeat);

      // System notification: Rest! when focus ends, Focus! when break ends
      const notificationTitle = completedMode === "pomodoro" ? "Rest!" : "Focus!";
      NotificationService.notify(notificationTitle, undefined, this.onNotificationClick);
    }

    if (completedMode === "pomodoro") {
      if (this.onPomodoroComplete) {
        this.onPomodoroComplete();
      }

      // Check if long break interval reached
      const isLongBreak = this.round % this.settings.longBreakInterval === 0;
      const nextMode: TimerMode = isLongBreak ? "longBreak" : "shortBreak";
      this.switchMode(nextMode, this.settings.autoStartBreaks, true);
    } else {
      // Finished a break
      this.round += 1;
      this.switchMode("pomodoro", this.settings.autoStartPomodoros, true);
    }
  }

  public getSettings(): PomofocusSettings {
    return this.settings;
  }

  public destroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.fallbackActivityHandler && typeof window !== "undefined") {
      window.removeEventListener("pointerdown", this.fallbackActivityHandler, true);
      window.removeEventListener("keydown", this.fallbackActivityHandler, true);
      window.removeEventListener("wheel", this.fallbackActivityHandler, true);
      window.removeEventListener("touchstart", this.fallbackActivityHandler, true);
      this.fallbackActivityHandler = null;
    }
    this.listeners.clear();
  }
}
