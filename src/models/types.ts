export const VIEW_TYPE_POMOFOCUS = "a1-pomofocus-view";

export type TimerMode = "pomodoro" | "shortBreak" | "longBreak";

export type SoundType = "wood" | "bell" | "digital" | "bird" | "kitchen" | "none";

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  actPomodoros: number;
  estPomodoros: number;
  note?: string;
  createdAt: number;
}

export interface PomofocusSettings {
  // Timer durations in minutes
  pomoTime: number;
  shortBreakTime: number;
  longBreakTime: number;
  longBreakInterval: number;

  // Automation
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;

  // Tasks behavior
  autoCheckTasks: boolean;
  checkToBottom: boolean;

  // Sounds
  alarmSound: SoundType;
  alarmVolume: number; // 0-100
  alarmRepeat: number; // repeat count
  focusSound: string;

  // Themes & UI
  colorTheme: "teal" | "green" | "blue";
  hourFormat: "24" | "12";
  darkModeWhenRunning: boolean;

  // Persisted state
  currentMode: TimerMode;
  pomodoroRound: number;
  tasks: TaskItem[];
  activeTaskId: string | null;
}

export const DEFAULT_SETTINGS: PomofocusSettings = {
  pomoTime: 50,
  shortBreakTime: 10,
  longBreakTime: 20,
  longBreakInterval: 3,

  autoStartBreaks: true,
  autoStartPomodoros: true,

  autoCheckTasks: false,
  checkToBottom: true,

  alarmSound: "wood",
  alarmVolume: 80,
  alarmRepeat: 2,
  focusSound: "none",

  colorTheme: "teal",
  hourFormat: "24",
  darkModeWhenRunning: false,

  currentMode: "pomodoro",
  pomodoroRound: 1,
  tasks: [],
  activeTaskId: null,
};
