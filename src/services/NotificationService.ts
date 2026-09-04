import { Notice } from "obsidian";

export class NotificationService {
  public static requestPermissionIfNeeded(): void {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }
  }

  public static notify(title: string, message: string): void {
    // 1. In-app Obsidian Notice
    new Notice(`${title}\n${message}`, 6000);

    // 2. Windows native system notification
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(title, {
            body: message,
            silent: true, // We trigger our custom sound via SoundService
          });
        } catch (e) {
          console.warn("Native notification failed:", e);
        }
      }
    }
  }
}
