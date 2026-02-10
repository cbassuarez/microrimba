import { z } from 'zod';

export const scaleSchema = z.object({
  scale_id: z.string().min(1),
  label: z.string().min(1),
  source_manifest: z.string().min(1),
  edo: z.union([z.number().int().positive(), z.string().min(1)]),
  bar_count: z.number().int().nonnegative(),
});

export const instrumentSchema = z.object({
  instrument_id: z.string().min(1),
  label: z.string().min(1),
});

export const barSchema = z.object({
  bar_id: z.string().min(1),
  instrument_id: z.string().min(1),
  scale_id: z.string().min(1),
  step: z.number().int().nonnegative(),
  step_name: z.string().min(1),
  cents_from_step0: z.number(),
  ratio_to_step0: z.string().min(1),
  freq_hz: z.number().positive(),
  source_manifest: z.string().min(1),
  ordinal_in_scale: z.number().int().positive(),
});

export const sampleSchema = z.object({
  bar_id: z.string().min(1),
  audio_path: z.string().regex(/^audio\/.+\.wav$/i),
  duration_seconds: z.number().positive(),
  sample_rate_hz: z.number().int().positive(),
  channels: z.number().int().positive(),
});

export const scalesSchema = z.array(scaleSchema);
export const instrumentsSchema = z.array(instrumentSchema);
export const barsSchema = z.array(barSchema);
export const samplesSchema = z.array(sampleSchema);

export type Scale = z.infer<typeof scaleSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type Bar = z.infer<typeof barSchema>;
export type Sample = z.infer<typeof sampleSchema>;
