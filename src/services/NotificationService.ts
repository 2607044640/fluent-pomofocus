import { Notice } from "obsidian";

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
    } catch (e) {
      console.warn("window.focus() failed:", e);
    }

    try {
      const req =
        (window as unknown as { require?: (mod: string) => any }).require ||
        (typeof require !== "undefined" ? require : null);
      if (req) {
        const electron = req("electron");
        const remote = electron?.remote || req("@electron/remote");
        const currentWin = remote?.getCurrentWindow?.();
        if (currentWin) {
          if (currentWin.isMinimized?.()) {
            currentWin.restore?.();
          }
          currentWin.show?.();
          currentWin.focus?.();
        }
      }
    } catch (e) {
      // Remote electron window access might not be available; window.focus() was executed above
    }
  }

  public static notify(title: string, message?: string, onClick?: () => void): void {
    // 1. In-app Obsidian Notice
    const noticeText = message ? `${title}\n${message}` : title;
    const notice = new Notice(noticeText, 6000);
    if (onClick) {
      const el = (notice as unknown as { noticeEl?: HTMLElement }).noticeEl;
      if (el) {
        el.style.cursor = "pointer";
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
        } catch (e) {
          console.warn("Native notification failed:", e);
        }
      }
    }
  }
}
