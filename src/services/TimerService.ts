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
  autoPauseRemainingSeconds: number | null;
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
  private autoPauseRemainingSeconds: number = 30 * 60;
  private autoPauseEndTime: number = 0;
  private lastAutoPauseEnabled: boolean = false;
  private lastAutoPauseMinutes: number = 30;

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
    this.lastAutoPauseEnabled = Boolean(settings.autoPauseEnabled);
    this.lastAutoPauseMinutes = this.getAutoPauseThresholdMinutes();
    this.autoPauseRemainingSeconds = this.lastAutoPauseMinutes * 60;
    this.initDurationForMode(this.mode);
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

  public resetAutoPauseCountdown(): void {
    this.autoPaused = false;
    this.autoPauseRemainingSeconds = this.getAutoPauseThresholdMinutes() * 60;
    if (this.isRunning && this.settings.autoPauseEnabled) {
      this.autoPauseEndTime = Date.now() + this.autoPauseRemainingSeconds * 1000;
    }
    this.notify();
  }

  private getAutoPauseThresholdMinutes(): number {
    return Math.max(1, Math.min(720, Math.round(Number(this.settings.autoPauseMinutes) || 30)));
  }

  private getVisibleAutoPauseRemainingSeconds(): number | null {
    if (!this.isRunning || !this.settings.autoPauseEnabled) return null;
    return Math.max(0, this.autoPauseRemainingSeconds);
  }

  private triggerAutoPause(): void {
    this.soundService.stopSound();
    this.pause(true);
    const mins = this.getAutoPauseThresholdMinutes();
    NotificationService.notice(`Pomofocus auto-paused after ${mins}m`);
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
      autoPauseRemainingSeconds: this.getVisibleAutoPauseRemainingSeconds(),
    };
  }

  public updateSettings(newSettings: PomofocusSettings): void {
    this.settings = newSettings;
    const nextEnabled = Boolean(newSettings.autoPauseEnabled);
    const nextMins = this.getAutoPauseThresholdMinutes();

    if (!nextEnabled) {
      this.autoPaused = false;
    }
    if (nextEnabled !== this.lastAutoPauseEnabled || nextMins !== this.lastAutoPauseMinutes) {
      this.lastAutoPauseEnabled = nextEnabled;
      this.lastAutoPauseMinutes = nextMins;
      this.autoPauseRemainingSeconds = nextMins * 60;
      if (this.isRunning && nextEnabled) {
        this.autoPauseEndTime = Date.now() + this.autoPauseRemainingSeconds * 1000;
      }
      if (nextEnabled) {
        this.autoPaused = false;
      }
    }

    if (!this.isRunning) {
      const nextTotalSeconds = this.getDurationMinutesForMode(this.mode) * 60;
      if (nextTotalSeconds !== this.totalSeconds) {
        this.totalSeconds = nextTotalSeconds;
        this.remainingSeconds = nextTotalSeconds;
      }
    }
    this.notify();
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
      this.autoPauseRemainingSeconds = this.getAutoPauseThresholdMinutes() * 60;
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
    if (!isAutoStart && (this.autoPaused || this.autoPauseRemainingSeconds <= 0)) {
      this.autoPauseRemainingSeconds = this.getAutoPauseThresholdMinutes() * 60;
    }
    this.autoPaused = false;
    if (this.remainingSeconds <= 0) {
      this.initDurationForMode(this.mode);
    }

    NotificationService.requestPermissionIfNeeded();

    const now = Date.now();
    this.isRunning = true;
    this.targetEndTime = now + this.remainingSeconds * 1000;
    if (this.settings.autoPauseEnabled) {
      this.autoPauseEndTime = now + this.autoPauseRemainingSeconds * 1000;
    }

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
    const now = Date.now();
    this.isRunning = false;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Lock in current remaining seconds based on exact time difference
    this.remainingSeconds = Math.max(0, Math.round((this.targetEndTime - now) / 1000));
    if (triggeredByAutoPause) {
      this.autoPauseRemainingSeconds = 0;
    } else if (this.settings.autoPauseEnabled) {
      this.autoPauseRemainingSeconds = Math.max(0, Math.round((this.autoPauseEndTime - now) / 1000));
    }
    this.notify();
  }

  public toggle(): void {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start(false);
    }
  }

  public reset(): void {
    this.autoPaused = false;
    this.pause();
    this.autoPauseRemainingSeconds = this.getAutoPauseThresholdMinutes() * 60;
    this.initDurationForMode(this.mode);
    this.notify();
    this.emitStateChange();
  }

  public skip(): void {
    this.autoPaused = false;
    this.completeCurrentPeriod(false);
  }

  private tick(): void {
    const now = Date.now();
    let autoPauseChanged = false;

    if (this.settings.autoPauseEnabled) {
      const nextAutoPauseRem = Math.max(0, Math.round((this.autoPauseEndTime - now) / 1000));
      if (nextAutoPauseRem !== this.autoPauseRemainingSeconds) {
        this.autoPauseRemainingSeconds = nextAutoPauseRem;
        autoPauseChanged = true;
      }
      if (nextAutoPauseRem <= 0) {
        this.triggerAutoPause();
        return;
      }
    }

    const diffMs = this.targetEndTime - now;
    const remaining = Math.max(0, Math.round(diffMs / 1000));

    if (remaining !== this.remainingSeconds || autoPauseChanged) {
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
    this.listeners.clear();
  }
}
