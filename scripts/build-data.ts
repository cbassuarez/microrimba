import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import {
  barsSchema,
  instrumentsSchema,
  samplesSchema,
  scalesSchema,
  type Bar,
  type Instrument,
  type Sample,
  type Scale,
} from '../src/models';

const ROOT = process.cwd();
const MANIFEST_DIR = path.join(ROOT, 'manifest');
const AUDIO_DIR = path.join(ROOT, 'audio');
const OUT_DIR = path.join(ROOT, 'data', 'bars');

type RawRow = Record<string, string>;

function parseNumber(raw: string, ctx: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number for ${ctx}: ${raw}`);
  }
  return value;
}

function parseRatio(raw: string, ctx: string): number {
  const trimmed = raw.trim();
  if (/^-?\d+(\.\d+)?\/-?\d+(\.\d+)?$/.test(trimmed)) {
    const [n, d] = trimmed.split('/').map(Number);
    if (d === 0) {
      throw new Error(`Invalid ratio denominator for ${ctx}: ${raw}`);
    }
    const value = n / d;
    if (!(value > 0)) {
      throw new Error(`Ratio must be positive for ${ctx}: ${raw}`);
    }
    return value;
  }
  const value = parseNumber(trimmed, ctx);
  if (!(value > 0)) {
    throw new Error(`Ratio must be positive for ${ctx}: ${raw}`);
  }
  return value;
}

function inferScaleId(fileBase: string, rows: RawRow[]): string {
  const lowered = fileBase.toLowerCase();
  const nonEmptyEdo = rows.map((r) => r.edo?.trim()).find(Boolean);
  if (nonEmptyEdo && /^\d+$/.test(nonEmptyEdo) && lowered.includes('edo')) {
    return `${Number(nonEmptyEdo)}edo`;
  }
  return lowered;
}

function getOrdinalFromBarId(barId: string): number {
  const match = barId.match(/-(\d+)$/);
  if (!match) {
    throw new Error(`bar_id missing ordinal suffix: ${barId}`);
  }
  return Number(match[1]);
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const collected: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await listFilesRecursive(full)));
    } else {
      collected.push(full);
    }
  }
  return collected;
}

async function readWavMetadata(filePath: string): Promise<Pick<Sample, 'duration_seconds' | 'sample_rate_hz' | 'channels'>> {
  const data = await fs.readFile(filePath);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Unsupported WAV format: ${filePath}`);
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataSize = 0;

  while (offset + 8 <= data.length) {
    const chunkId = data.toString('ascii', offset, offset + 4);
    const chunkSize = data.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      channels = data.readUInt16LE(chunkStart + 2);
      sampleRate = data.readUInt32LE(chunkStart + 4);
      bitsPerSample = data.readUInt16LE(chunkStart + 14);
    }

    if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!sampleRate || !channels || !bitsPerSample || !dataSize) {
    throw new Error(`Incomplete WAV metadata: ${filePath}`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const duration = dataSize / (sampleRate * channels * bytesPerSample);
  return {
    duration_seconds: Number(duration.toFixed(6)),
    sample_rate_hz: sampleRate,
    channels,
  };
}

function parseCsv(csvText: string, fileName: string): RawRow[] {
  const parsed = Papa.parse<RawRow>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
  });
  if (parsed.errors.length) {
    throw new Error(`CSV parse errors in ${fileName}: ${parsed.errors.map((e) => e.message).join('; ')}`);
  }
  return parsed.data;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const manifestFiles = (await fs.readdir(MANIFEST_DIR))
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort((a, b) => a.localeCompare(b));

  const bars: Bar[] = [];
  const scales: Scale[] = [];
  const instrumentMap = new Map<string, Instrument>();

  for (const fileName of manifestFiles) {
    const fullPath = path.join(MANIFEST_DIR, fileName);
    const csvText = await fs.readFile(fullPath, 'utf8');
    const rows = parseCsv(csvText, fileName);
    const fileBase = path.basename(fileName, '.csv');
    const scale_id = inferScaleId(fileBase, rows);

    for (const row of rows) {
      const required = [
        'bar_id',
        'instrument_id',
        'step',
        'step_name',
        'cents_from_step0',
        'ratio_to_step0',
        'freq_if_step0_is_C',
      ] as const;
      for (const key of required) {
        if (!row[key] || !String(row[key]).trim()) {
          throw new Error(`Missing required field '${key}' in ${fileName}`);
        }
      }

      const hzColumns = Object.keys(row).filter((k) => /^hz/i.test(k) && k !== 'freq_if_step0_is_C');
      if (hzColumns.length) {
        // Explicitly ignored: non-canonical hz columns are not propagated.
      }

      const bar: Bar = {
        bar_id: row.bar_id.trim(),
        instrument_id: row.instrument_id.trim(),
        scale_id,
        step: parseNumber(row.step, `${fileName}:${row.bar_id}:step`),
        step_name: row.step_name.trim(),
        cents_from_step0: parseNumber(row.cents_from_step0, `${fileName}:${row.bar_id}:cents_from_step0`),
        ratio_to_step0: parseRatio(row.ratio_to_step0, `${fileName}:${row.bar_id}:ratio_to_step0`),
        freq_hz: parseNumber(row.freq_if_step0_is_C, `${fileName}:${row.bar_id}:freq_if_step0_is_C`),
        source_manifest: path.posix.join('manifest', fileName),
        ordinal_in_scale: getOrdinalFromBarId(row.bar_id.trim()),
      };

      bars.push(bar);

      if (!instrumentMap.has(bar.instrument_id)) {
        instrumentMap.set(bar.instrument_id, {
          instrument_id: bar.instrument_id,
          label: bar.instrument_id,
        });
      }
    }

    const first = rows[0];
    const edoRaw = first?.edo?.trim() ?? 'unknown';
    const edo = /^\d+$/.test(edoRaw) ? Number(edoRaw) : edoRaw;
    scales.push({
      scale_id,
      label: scale_id,
      source_manifest: path.posix.join('manifest', fileName),
      edo,
      bar_count: rows.length,
    });
  }

  bars.sort((a, b) => a.scale_id.localeCompare(b.scale_id) || a.ordinal_in_scale - b.ordinal_in_scale || a.bar_id.localeCompare(b.bar_id));
  scales.sort((a, b) => a.scale_id.localeCompare(b.scale_id));
  const instruments = [...instrumentMap.values()].sort((a, b) => a.instrument_id.localeCompare(b.instrument_id));

  const barIds = new Set<string>();
  for (const bar of bars) {
    if (barIds.has(bar.bar_id)) {
      throw new Error(`Duplicate bar_id detected: ${bar.bar_id}`);
    }
    barIds.add(bar.bar_id);
  }

  const audioFiles = (await listFilesRecursive(AUDIO_DIR)).filter((f) => f.toLowerCase().endsWith('.wav'));
  const barIdLookup = new Map<string, string>();
  for (const id of barIds) {
    barIdLookup.set(id.toLowerCase(), id);
  }

  const samples: Sample[] = [];
  const unmatchedAudioFiles: string[] = [];

  for (const audioFile of audioFiles) {
    const relative = path.relative(ROOT, audioFile).split(path.sep).join('/');
    const stem = path.basename(audioFile, path.extname(audioFile)).toLowerCase();
    const matchedBarId = barIdLookup.get(stem);

    if (!matchedBarId) {
      unmatchedAudioFiles.push(relative);
      continue;
    }

    const wavMeta = await readWavMetadata(audioFile);
    samples.push({
      bar_id: matchedBarId,
      audio_path: relative,
      ...wavMeta,
    });
  }

  samples.sort((a, b) => a.bar_id.localeCompare(b.bar_id) || a.audio_path.localeCompare(b.audio_path));

  const sampleBarCount = new Map<string, number>();
  for (const sample of samples) {
    sampleBarCount.set(sample.bar_id, (sampleBarCount.get(sample.bar_id) ?? 0) + 1);
  }

  const missingAudioBars = bars
    .filter((bar) => !sampleBarCount.has(bar.bar_id))
    .map((bar) => bar.bar_id)
    .sort((a, b) => a.localeCompare(b));

  barsSchema.parse(bars);
  scalesSchema.parse(scales);
  instrumentsSchema.parse(instruments);
  samplesSchema.parse(samples);

  const index = {
    bars_by_id: Object.fromEntries(bars.map((bar) => [bar.bar_id, bar])),
    bars_by_scale: Object.fromEntries(scales.map((scale) => [scale.scale_id, bars.filter((bar) => bar.scale_id === scale.scale_id).map((bar) => bar.bar_id)])),
    samples_by_bar: Object.fromEntries(
      [...sampleBarCount.keys()].sort((a, b) => a.localeCompare(b)).map((bar_id) => [bar_id, samples.filter((sample) => sample.bar_id === bar_id)]),
    ),
  };

  await fs.writeFile(path.join(OUT_DIR, 'bars.json'), `${JSON.stringify(bars, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'scales.json'), `${JSON.stringify(scales, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'instruments.json'), `${JSON.stringify(instruments, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'samples.json'), `${JSON.stringify(samples, null, 2)}\n`);
  await fs.writeFile(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

  console.log('Data build completed.');
  console.log(`- Manifest CSV files: ${manifestFiles.length}`);
  console.log(`- Bars: ${bars.length}`);
  console.log(`- Scales: ${scales.length}`);
  console.log(`- Instruments: ${instruments.length}`);
  console.log(`- Samples: ${samples.length}`);
  console.log(`- Bars missing audio: ${missingAudioBars.length}`);
  if (missingAudioBars.length) {
    console.log(`  ${missingAudioBars.join(', ')}`);
  }
  console.log(`- Unmatched audio files: ${unmatchedAudioFiles.length}`);
  if (unmatchedAudioFiles.length) {
    console.log(`  ${unmatchedAudioFiles.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
