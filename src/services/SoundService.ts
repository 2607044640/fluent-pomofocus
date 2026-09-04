import { SoundType } from "../models/types";

export class SoundService {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public playSound(type: SoundType, volumePercent: number, repeat: number): void {
    if (type === "none" || volumePercent <= 0) return;
    const volume = Math.min(Math.max(volumePercent / 100, 0), 1);
    const rep = Math.max(1, Math.min(repeat || 1, 10));

    switch (type) {
      case "wood":
        this.playWood(volume, rep);
        break;
      case "bell":
        this.playBell(volume, rep);
        break;
      case "digital":
        this.playDigital(volume, rep);
        break;
    }
  }

  private playWood(volume: number, repeat: number): void {
    const ctx = this.getContext();
    for (let i = 0; i < repeat; i++) {
      const startTime = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, startTime);
      osc.frequency.exponentialRampToValueAtTime(140, startTime + 0.07);

      gain.gain.setValueAtTime(volume * 0.9, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.09);
    }
  }

  private playBell(volume: number, repeat: number): void {
    const ctx = this.getContext();
    for (let i = 0; i < repeat; i++) {
      const startTime = ctx.currentTime + i * 0.55;

      // Fundamental frequency
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, startTime); // A5

      // Harmonic overtone for realistic bell timbre
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1760, startTime); // A6

      gain1.gain.setValueAtTime(volume * 0.7, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      gain2.gain.setValueAtTime(volume * 0.3, startTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(startTime);
      osc1.stop(startTime + 0.52);
      osc2.start(startTime);
      osc2.stop(startTime + 0.37);
    }
  }

  private playDigital(volume: number, repeat: number): void {
    const ctx = this.getContext();
    for (let i = 0; i < repeat; i++) {
      const startTime = ctx.currentTime + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(1046.5, startTime); // C6

      gain.gain.setValueAtTime(volume * 0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.13);
    }
  }
}
