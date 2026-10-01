import { Notice } from "obsidian";

interface ElectronWindow {
  isMinimized?: () => boolean;
  restore?: () => void;
  show?: () => void;
  focus?: () => void;
}

interface ElectronRemote {
  getCurrentWindow?: () => ElectronWindow | undefined;
}

interface ElectronModule {
  remote?: ElectronRemote;
}

export class NotificationService {
  public static requestPermissionIfNeeded(): void {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
  }

  public static focusObsidianWindow(): void {
    try {
      window.focus();
    } catch {
      // Ignore window focus error
    }

    try {
      const winWithReq = window as unknown as { require?: (mod: string) => unknown };
      const req: ((mod: string) => unknown) | null =
        typeof winWithReq.require === "function"
          ? winWithReq.require
          : typeof require === "function"
            ? (require as (mod: string) => unknown)
            : null;
      if (req) {
        const electron = req("electron") as ElectronModule | undefined;
        const remoteFallback = req("@electron/remote") as ElectronRemote | undefined;
        const remote = electron?.remote || remoteFallback;
        const currentWin = remote?.getCurrentWindow?.();
        if (currentWin) {
          if (currentWin.isMinimized?.()) {
            currentWin.restore?.();
          }
          currentWin.show?.();
          currentWin.focus?.();
        }
      }
    } catch {
      // Remote electron window access might not be available; window.focus() was executed above
    }
  }

  public static notify(title: string, message?: string, onClick?: () => void): void {
    // 1. In-app Notice
    const noticeText = message ? `${title}\n${message}` : title;
    const notice = new Notice(noticeText, 6000);
    if (onClick) {
      const el = (notice as unknown as { noticeEl?: HTMLElement }).noticeEl;
      if (el) {
        el.setCssStyles({ cursor: "pointer" });
        el.addEventListener("click", () => {
          NotificationService.focusObsidianWindow();
          onClick();
        });
      }
    }

    // 2. Windows native system notification
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          const options: NotificationOptions = {
            silent: true, // We trigger our custom sound via SoundService
          };
          if (message) {
            options.body = message;
          }

          const notification = new Notification(title, options);
          notification.onclick = () => {
            NotificationService.focusObsidianWindow();
            if (onClick) {
              onClick();
            }
          };
        } catch {
          // Native notification constructor might fail in certain environments
        }
      }
    }
  }
}

