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

  private activeSources: AudioBufferSourceNode[] = [];
  private activeOscillators: OscillatorNode[] = [];
  private activeGainNodes: GainNode[] = [];
  private pendingTimer: number | null = null;
  private currentPlayId: number = 0;

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
   * Check whether any sound or repeat cycle is currently playing
   */
  public isPlaying(): boolean {
    return (
      this.activeSources.length > 0 ||
      this.activeOscillators.length > 0 ||
      this.pendingTimer !== null
    );
  }

  /**
   * Immediately cancel and stop any active audio playback, repeat cycles, and timers
   */
  public stopSound(): void {
    this.currentPlayId++;

    if (this.pendingTimer !== null) {
      window.clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];

    for (const osc of this.activeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    }
    this.activeOscillators = [];

    for (const gain of this.activeGainNodes) {
      try {
        gain.disconnect();
      } catch {}
    }
    this.activeGainNodes = [];
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
      return null;
    }
    this.isDownloading.add(type);

    const meta = SOUND_METAS[type];
    if (!meta) {
      this.isDownloading.delete(type);
      return null;
    }

    const ctx = this.getContext();
    const pluginDir = this.manifest?.dir || ".obsidian/plugins/fluent-pomofocus";
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

  /**
   * Play sound with volume amplification and exact repeat sequencing
   */
  public async playSound(type: SoundType, volumePercent: number, repeat: number): Promise<void> {
    if (type === "none" || volumePercent <= 0) {
      this.stopSound();
      return;
    }

    // Stop previous sound playback before starting new one
    this.stopSound();

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
      this.playSynthesized(ctx, type, volume, rep);
    }
  }

  /**
   * Sequential playback of audio buffer for exact repeat times
   */
  private playAudioBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    volume: number,
    totalRepeats: number
  ): void {
    const playId = this.currentPlayId;
    let currentIteration = 0;

    const playNext = () => {
      if (this.currentPlayId !== playId) return;
      if (currentIteration >= totalRepeats) {
        this.stopSound();
        return;
      }

      currentIteration++;

      // Volume amplification (up to 200%)
      const gainValue = volume * 2.0;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(gainValue, ctx.currentTime);

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(24, ctx.currentTime);
      compressor.ratio.setValueAtTime(10, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);

      gainNode.connect(compressor);
      compressor.connect(ctx.destination);
      this.activeGainNodes.push(gainNode);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      this.activeSources.push(source);

      source.onended = () => {
        if (this.currentPlayId !== playId) return;
        this.activeSources = this.activeSources.filter((s) => s !== source);

        if (currentIteration < totalRepeats) {
          // 100ms pause between consecutive repeats
          this.pendingTimer = window.setTimeout(() => {
            if (this.currentPlayId === playId) {
              playNext();
            }
          }, 100);
        } else {
          this.stopSound();
        }
      };

      source.start();
    };

    playNext();
  }

  /**
   * Sequential playback of synthesized fallback audio
   */
  private playSynthesized(
    ctx: AudioContext,
    type: SoundType,
    volume: number,
    totalRepeats: number
  ): void {
    const playId = this.currentPlayId;
    let currentIteration = 0;

    const playNext = () => {
      if (this.currentPlayId !== playId) return;
      if (currentIteration >= totalRepeats) {
        this.stopSound();
        return;
      }

      currentIteration++;
      const durationSec = this.dispatchSynthOneShot(ctx, type, volume);
      const delayMs = Math.round(durationSec * 1000) + 120;

      if (currentIteration < totalRepeats) {
        this.pendingTimer = window.setTimeout(() => {
          if (this.currentPlayId === playId) {
            playNext();
          }
        }, delayMs);
      } else {
        this.pendingTimer = window.setTimeout(() => {
          if (this.currentPlayId === playId) {
            this.stopSound();
          }
        }, Math.round(durationSec * 1000));
      }
    };

    playNext();
  }

  private dispatchSynthOneShot(ctx: AudioContext, type: SoundType, volume: number): number {
    switch (type) {
      case "wood":
        return this.synthWood(ctx, volume);
      case "bell":
        return this.synthBell(ctx, volume);
      case "digital":
        return this.synthDigital(ctx, volume);
      case "bird":
        return this.synthBird(ctx, volume);
      case "kitchen":
        return this.synthKitchen(ctx, volume);
      default:
        return 0.1;
    }
  }

  private synthWood(ctx: AudioContext, volume: number): number {
    const startTime = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(900, startTime);
    osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.1);

    gain.gain.setValueAtTime(volume * 1.6, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    this.activeOscillators.push(osc);
    this.activeGainNodes.push(gain);

    osc.start(startTime);
    osc.stop(startTime + 0.12);
    return 0.15;
  }

  private synthBell(ctx: AudioContext, volume: number): number {
    const startTime = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, startTime);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1760, startTime);

    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(2640, startTime);

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

    this.activeOscillators.push(osc1, osc2, osc3);
    this.activeGainNodes.push(gain1, gain2, gain3);

    osc1.start(startTime);
    osc1.stop(startTime + 0.78);
    osc2.start(startTime);
    osc2.stop(startTime + 0.52);
    osc3.start(startTime);
    osc3.stop(startTime + 0.32);
    return 0.8;
  }

  private synthDigital(ctx: AudioContext, volume: number): number {
    const cycleStart = ctx.currentTime;
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

      this.activeOscillators.push(osc);
      this.activeGainNodes.push(gain);

      osc.start(startTime);
      osc.stop(startTime + 0.11);
    }
    return 0.32;
  }

  private synthBird(ctx: AudioContext, volume: number): number {
    const cycleStart = ctx.currentTime;
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

      this.activeOscillators.push(osc);
      this.activeGainNodes.push(gain);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    }
    return 0.42;
  }

  private synthKitchen(ctx: AudioContext, volume: number): number {
    const cycleStart = ctx.currentTime;
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

      this.activeOscillators.push(osc);
      this.activeGainNodes.push(gain);

      osc.start(startTime);
      osc.stop(startTime + 0.07);
    }
    return 0.36;
  }
}
