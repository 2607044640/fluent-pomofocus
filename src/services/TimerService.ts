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

  // Callback when a pomodoro completes (to increment active task count)
  public onPomodoroComplete?: () => void;
  // Callback when state should be saved
  public onStateChange?: () => void;

  constructor(settings: PomofocusSettings, soundService: SoundService) {
    this.settings = settings;
    this.soundService = soundService;
    this.mode = settings.currentMode || "pomodoro";
    this.round = settings.pomodoroRound || 1;
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
    if (this.onStateChange) {
      this.onStateChange();
    }
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
    };
  }

  public updateSettings(newSettings: PomofocusSettings): void {
    this.settings = newSettings;
    if (!this.isRunning) {
      this.initDurationForMode(this.mode);
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

  public switchMode(targetMode: TimerMode, autoStart: boolean = false): void {
    this.pause();
    this.mode = targetMode;
    this.initDurationForMode(targetMode);
    if (autoStart) {
      this.start();
    } else {
      this.notify();
    }
  }

  public start(): void {
    if (this.isRunning) return;
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

  public pause(): void {
    if (!this.isRunning) return;
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
      this.pause();
    } else {
      this.start();
    }
  }

  public reset(): void {
    this.pause();
    this.initDurationForMode(this.mode);
    this.notify();
  }

  public skip(): void {
    this.completeCurrentPeriod(false);
  }

  private tick(): void {
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
      // Play configured alarm sound
      this.soundService.playSound(
        this.settings.alarmSound,
        this.settings.alarmVolume,
        this.settings.alarmRepeat
      );

      // System notification
      const modeLabel =
        completedMode === "pomodoro"
          ? "Pomodoro Finished!"
          : completedMode === "shortBreak"
          ? "Short Break Ended!"
          : "Long Break Ended!";
      const nextMsg =
        completedMode === "pomodoro"
          ? "Time to take a break."
          : "Time to focus!";
      NotificationService.notify(modeLabel, nextMsg);
    }

    if (completedMode === "pomodoro") {
      if (this.onPomodoroComplete) {
        this.onPomodoroComplete();
      }

      // Check if long break interval reached
      const isLongBreak = this.round % this.settings.longBreakInterval === 0;
      const nextMode: TimerMode = isLongBreak ? "longBreak" : "shortBreak";
      this.switchMode(nextMode, this.settings.autoStartBreaks);
    } else {
      // Finished a break
      this.round += 1;
      this.switchMode("pomodoro", this.settings.autoStartPomodoros);
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
