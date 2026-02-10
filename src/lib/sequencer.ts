import type { BarId } from '../data/types';

export type SequenceMode = 'constant' | 'expAccelerando';

export type SequenceOpts = {
  intervalMs: number;
  overlapMs: number;
  mode: SequenceMode;
  expFactor?: number;
  minIntervalMs?: number;
  gain?: number;
};

export type SequenceAudioEngine = {
  context: AudioContext;
  getBuffer: (barId: BarId) => Promise<AudioBuffer>;
  playBufferAt: (barId: BarId, buffer: AudioBuffer, whenSeconds: number, opts?: { gain?: number }) => string;
};

export async function playSequence(
  engine: SequenceAudioEngine,
  barIds: BarId[],
  opts: SequenceOpts,
): Promise<string[]> {
  if (!barIds.length) return [];

  const buffers = await Promise.all(barIds.map((barId) => engine.getBuffer(barId)));

  const ids: string[] = [];
  let t = engine.context.currentTime + 0.03;
  for (let i = 0; i < buffers.length; i += 1) {
    const id = engine.playBufferAt(barIds[i], buffers[i], t, { gain: opts.gain });
    ids.push(id);
    const dt =
      opts.mode === 'expAccelerando'
        ? Math.max(opts.minIntervalMs ?? 20, opts.intervalMs * Math.pow(opts.expFactor ?? 0.93, i))
        : opts.intervalMs;
    t += dt / 1000;
  }

  return ids;
}
