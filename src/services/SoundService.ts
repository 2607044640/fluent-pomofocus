import { App, PluginManifest } from "obsidian";
import { SoundType } from "../models/types";

interface SoundMeta {
  name: string;
  filename: string;
  url: string;
}

export const SOUND_METAS: Record<Exclude<SoundType, "none">, SoundMeta> = {
  wood: {
    name: "Wood (木鱼/木块)",
    filename: "alarm-wood.mp3",
    url: "https://pomofocus.io/audios/alarms/alarm-wood.mp3",
  },
  bell: {
    name: "Bell (清脆钟鸣)",
    filename: "alarm-bell.mp3",
    url: "https://pomofocus.io/audios/alarms/alarm-bell.mp3",
  },
  bird: {
    name: "Bird (自然鸟鸣)",
    filename: "alarm-bird.mp3",
    url: "https://pomofocus.io/audios/alarms/alarm-bird.mp3",
  },
  digital: {
    name: "Digital (电子闹铃)",
    filename: "alarm-digital.mp3",
    url: "https://pomofocus.io/audios/alarms/alarm-digital.mp3",
  },
  kitchen: {
    name: "Kitchen (机械闹钟)",
    filename: "alarm-kitchen.mp3",
    url: "https://pomofocus.io/audios/alarms/alarm-kitchen.mp3",
  },
};

export class SoundService {
  private app?: App;
  private manifest?: PluginManifest;
  private ctx: AudioContext | null = null;
  private audioBufferCache: Map<SoundType, AudioBuffer> = new Map();
  private isDownloading: Set<SoundType> = new Set();

  constructor(app?: App, manifest?: PluginManifest) {
    this.app = app;
    this.manifest = manifest;
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Preload all sound assets in the background
   */
  public async preloadAll(): Promise<void> {
    const types: SoundType[] = ["wood", "bell", "bird", "digital", "kitchen"];
    for (const type of types) {
      void this.loadSound(type);
    }
  }

  /**
   * Load sound buffer from memory cache, local vault file, or remote CDN
   */
  public async loadSound(type: SoundType): Promise<AudioBuffer | null> {
    if (type === "none") return null;
    if (this.audioBufferCache.has(type)) {
      return this.audioBufferCache.get(type)!;
    }

    if (this.isDownloading.has(type)) {
      // Avoid duplicate parallel fetches
      return null;
    }
    this.isDownloading.add(type);

    const meta = SOUND_METAS[type];
    if (!meta) {
      this.isDownloading.delete(type);
      return null;
    }

    const ctx = this.getContext();
    const pluginDir = this.manifest?.dir || ".obsidian/plugins/A1Pomofocus";
    const soundsDir = `${pluginDir}/sounds`;
    const filePath = `${soundsDir}/${meta.filename}`;

    try {
      // 1. Try reading from local vault adapter cache
      if (this.app?.vault?.adapter) {
        const exists = await this.app.vault.adapter.exists(filePath);
        if (exists) {
          const binary = await this.app.vault.adapter.readBinary(filePath);
          const audioBuffer = await ctx.decodeAudioData(binary.slice(0));
          this.audioBufferCache.set(type, audioBuffer);
          this.isDownloading.delete(type);
          return audioBuffer;
        }
      }

      // 2. Fetch from remote CDN if not present locally
      const res = await fetch(meta.url);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();

        // Save to local vault cache for future offline zero-latency use
        if (this.app?.vault?.adapter) {
          try {
            const dirExists = await this.app.vault.adapter.exists(soundsDir);
            if (!dirExists) {
              await this.app.vault.adapter.mkdir(soundsDir);
            }
            await this.app.vault.adapter.writeBinary(filePath, arrayBuf);
          } catch (storageErr) {
            console.warn("Failed to cache audio file locally:", storageErr);
          }
        }

        const audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
        this.audioBufferCache.set(type, audioBuffer);
        this.isDownloading.delete(type);
        return audioBuffer;
      }
    } catch (e) {
      console.warn(`Could not load real audio for ${type}, falling back to synthesizer:`, e);
    } finally {
      this.isDownloading.delete(type);
    }

    return null;
  }

  public async playSound(type: SoundType, volumePercent: number, repeat: number): Promise<void> {
    if (type === "none" || volumePercent <= 0) return;
    const ctx = this.getContext();
    const volume = Math.min(Math.max(volumePercent / 100, 0), 1);
    const rep = Math.max(1, Math.min(repeat || 1, 10));

    let buffer = this.audioBufferCache.get(type);
    if (!buffer) {
      buffer = (await this.loadSound(type)) || undefined;
    }

    if (buffer) {
      this.playAudioBuffer(ctx, buffer, volume, rep);
    } else {
      // Immediate fallback to amplified synthesized tone
      this.playSynthesized(ctx, type, volume, rep);
    }
  }

  /**
   * High-fidelity playback of recorded audio samples with volume amplification up to 2.0x
   */
  private playAudioBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    volume: number,
    repeat: number
  ): void {
    // Amplified volume scaling: 100% volume -> gain 2.0 for high acoustic loudness
    const gainValue = volume * 2.0;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gainValue, ctx.currentTime);

    // Dynamics compressor prevents distortion and clipping at high volume
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, ctx.currentTime);
    compressor.knee.setValueAtTime(24, ctx.currentTime);
    compressor.ratio.setValueAtTime(10, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    gainNode.connect(compressor);
    compressor.connect(ctx.destination);

    const spacing = Math.min(buffer.duration + 0.15, 3.0);

    for (let i = 0; i < repeat; i++) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      const startTime = ctx.currentTime + i * spacing;
      source.start(startTime);
    }
  }

  /**
   * Loud, multi-harmonic synthesized fallback when audio samples are unavailable
   */
  private playSynthesized(
    ctx: AudioContext,
    type: SoundType,
    volume: number,
    repeat: number
  ): void {
    switch (type) {
      case "wood":
        this.synthWood(ctx, volume, repeat);
        break;
      case "bell":
        this.synthBell(ctx, volume, repeat);
        break;
      case "digital":
        this.synthDigital(ctx, volume, repeat);
        break;
      case "bird":
        this.synthBird(ctx, volume, repeat);
        break;
      case "kitchen":
        this.synthKitchen(ctx, volume, repeat);
        break;
    }
  }

  private synthWood(ctx: AudioContext, volume: number, repeat: number): void {
    for (let i = 0; i < repeat; i++) {
      const startTime = ctx.currentTime + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(900, startTime);
      osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.1);

      gain.gain.setValueAtTime(volume * 1.6, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.12);
    }
  }

  private synthBell(ctx: AudioContext, volume: number, repeat: number): void {
    for (let i = 0; i < repeat; i++) {
      const startTime = ctx.currentTime + i * 0.8;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, startTime); // A5 fundamental

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1760, startTime); // A6 overtone

      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(2640, startTime); // E7 harmonic

      gain1.gain.setValueAtTime(volume * 1.2, startTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.75);

      gain2.gain.setValueAtTime(volume * 0.6, startTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      gain3.gain.setValueAtTime(volume * 0.3, startTime);
      gain3.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc1.connect(gain1);
      osc2.connect(gain2);
      osc3.connect(gain3);

      gain1.connect(ctx.destination);
      gain2.connect(ctx.destination);
      gain3.connect(ctx.destination);

      osc1.start(startTime);
      osc1.stop(startTime + 0.78);
      osc2.start(startTime);
      osc2.stop(startTime + 0.52);
      osc3.start(startTime);
      osc3.stop(startTime + 0.32);
    }
  }

  private synthDigital(ctx: AudioContext, volume: number, repeat: number): void {
    for (let i = 0; i < repeat; i++) {
      const cycleStart = ctx.currentTime + i * 0.6;
      // Double sharp beeps
      for (let b = 0; b < 2; b++) {
        const startTime = cycleStart + b * 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(1200, startTime);

        gain.gain.setValueAtTime(volume * 0.9, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.11);
      }
    }
  }

  private synthBird(ctx: AudioContext, volume: number, repeat: number): void {
    for (let i = 0; i < repeat; i++) {
      const cycleStart = ctx.currentTime + i * 0.7;
      // Rapid sweet frequency chirps
      for (let c = 0; c < 3; c++) {
        const startTime = cycleStart + c * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(2600 + c * 200, startTime);
        osc.frequency.exponentialRampToValueAtTime(4200, startTime + 0.08);

        gain.gain.setValueAtTime(volume * 1.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.1);
      }
    }
  }

  private synthKitchen(ctx: AudioContext, volume: number, repeat: number): void {
    for (let i = 0; i < repeat; i++) {
      const cycleStart = ctx.currentTime + i * 0.5;
      for (let k = 0; k < 4; k++) {
        const startTime = cycleStart + k * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(2400, startTime);

        gain.gain.setValueAtTime(volume * 1.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.07);
      }
    }
  }
}
