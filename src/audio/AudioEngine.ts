import type { BarId } from '../data/types';

export type Voice = { id: string; barId: BarId; startedAt: number; duration?: number; stop: () => void };

export class AudioEngine {
  private ctx = new AudioContext();
  private cache = new Map<string, AudioBuffer>();

  async play(url: string, barId: BarId): Promise<Voice> {
    const buffer = await this.loadBuffer(url);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    const id = `${barId}-${crypto.randomUUID()}`;
    src.start();
    return { id, barId, startedAt: performance.now(), duration: buffer.duration, stop: () => src.stop() };
  }

  private async loadBuffer(url: string) {
    if (this.cache.has(url)) return this.cache.get(url)!;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Missing audio: ${url}`);
    const arr = await res.arrayBuffer();
    const decoded = await this.ctx.decodeAudioData(arr);
    this.cache.set(url, decoded);
    return decoded;
  }
}
