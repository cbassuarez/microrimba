import type { BarId } from '../data/types';

export type VoiceHandle = {
  id: string;
  barId: BarId;
  startedAt: number;
  stop: () => void;
};

export class AudioEngine {
  readonly context = new AudioContext();

  private bufferCache = new Map<string, AudioBuffer>();
  private inflight = new Map<string, Promise<AudioBuffer>>();
  private pathByBar = new Map<BarId, string>();
  private active = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

  setPathMap(pathMap: Record<string, string>) {
    this.pathByBar = new Map(Object.entries(pathMap));
  }

  canPlay(barId: BarId) {
    return this.pathByBar.has(barId);
  }

  async getBuffer(barId: BarId): Promise<AudioBuffer> {
    const url = this.resolveUrl(barId);
    if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
    if (this.inflight.has(url)) return this.inflight.get(url)!;

    const load = fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Missing audio: ${url}`);
        const arr = await res.arrayBuffer();
        const decoded = await this.context.decodeAudioData(arr);
        this.bufferCache.set(url, decoded);
        return decoded;
      })
      .finally(() => {
        this.inflight.delete(url);
      });

    this.inflight.set(url, load);
    return load;
  }

  async play(barId: BarId, gain = 1): Promise<VoiceHandle> {
    const buffer = await this.getBuffer(barId);
    const id = this.playBufferAt(barId, buffer, this.context.currentTime, { gain });
    return {
      id,
      barId,
      startedAt: performance.now(),
      stop: () => this.stopVoice(id),
    };
  }

  playBufferAt(barId: BarId, buffer: AudioBuffer, whenSeconds: number, opts?: { gain?: number }): string {
    const id = `${barId}-${crypto.randomUUID()}`;
    const src = this.context.createBufferSource();
    src.buffer = buffer;

    const gainNode = this.context.createGain();
    gainNode.gain.value = opts?.gain ?? 1;

    src.connect(gainNode);
    gainNode.connect(this.context.destination);

    src.onended = () => {
      this.active.delete(id);
      src.disconnect();
      gainNode.disconnect();
    };

    this.active.set(id, { source: src, gain: gainNode });
    src.start(whenSeconds);
    return id;
  }

  stopVoice(id: string) {
    const node = this.active.get(id);
    if (!node) return;
    try {
      node.source.stop();
    } catch {
      // ignore when already stopped
    }
    this.active.delete(id);
  }

  stopAll() {
    [...this.active.keys()].forEach((id) => this.stopVoice(id));
  }

  private resolveUrl(barId: BarId): string {
    const path = this.pathByBar.get(barId);
    if (!path) throw new Error(`Missing audio path for ${barId}`);
    return `${import.meta.env.BASE_URL}${path}`;
  }
}
