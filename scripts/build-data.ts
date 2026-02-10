import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import { z } from 'zod';

const ROOT = path.resolve(path.join(import.meta.dirname, '..'));
const MANIFEST_DIR = path.join(ROOT, 'manifest');
const DATA_DIR = path.join(ROOT, 'data');
const AUDIO_DIR = path.join(ROOT, 'audio');
const TOLS = [5, 15, 30] as const;

const reqCols = ['bar_id', 'instrument_id', 'edo', 'step', 'step_name', 'cents_from_step0', 'ratio_to_step0', 'freq_if_step0_is_C'] as const;

type ScaleId = string;
type Bar = {
  barId: string;
  scaleId: ScaleId;
  instrumentId: string;
  edo: number | 'harmonic';
  step: number;
  stepName: string;
  centsFromStep0: number;
  ratioToStep0: string;
  hz: number;
  audioPath: string;
};

const BarSchema = z.object({
  barId: z.string(),
  scaleId: z.string().min(1),
  instrumentId: z.string(),
  edo: z.union([z.number(), z.literal('harmonic')]),
  step: z.number(),
  stepName: z.string(),
  centsFromStep0: z.number(),
  ratioToStep0: z.string(),
  hz: z.number(),
  audioPath: z.string(),
});

const centsDiff = (a: number, b: number) => 1200 * Math.log2(a / b);

const normalizeScaleId = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

const scaleIdFromFilename = (fileName: string): string => {
  const base = path.basename(fileName, '.csv').trim().toLowerCase();
  if (/^\d+edo$/.test(base)) return base;
  if (/^\d+$/.test(base)) return `${base}edo`;
  return base;
};

const deriveScaleId = (edoRaw: string, fileName: string): ScaleId => {
  const edo = normalizeScaleId(edoRaw);
  if (edo === 'harmonic') return 'harmonic';
  const asNum = Number(edo);
  if (Number.isFinite(asNum)) return `${asNum}edo`;
  if (/^\d+edo$/.test(edo)) return edo;
  return scaleIdFromFilename(fileName);
};

async function listAudioFileMap(scaleId: string) {
  const dir = path.join(AUDIO_DIR, scaleId);
  const byName = new Map<string, string>();
  const byLower = new Map<string, string>();
  try {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of ents) {
      if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.wav')) continue;
      byName.set(ent.name, ent.name);
      byLower.set(ent.name.toLowerCase(), ent.name);
    }
  } catch {
    // no directory available for this scale
  }
  return { byName, byLower };
}

function splitByRep(rows: Bar[], tol: number): Bar[][] {
  const out: Bar[][] = [];
  let i = 0;
  while (i < rows.length) {
    const seed = rows[i];
    const tmp = [seed];
    i++;
    while (i < rows.length && Math.abs(centsDiff(rows[i].hz, seed.hz)) <= tol) {
      tmp.push(rows[i]);
      i++;
    }
    const repBarId = [...tmp].map((x) => x.barId).sort((a, b) => a.localeCompare(b))[0];
    const rep = tmp.find((x) => x.barId === repBarId)!;
    const good = tmp.filter((x) => Math.abs(centsDiff(x.hz, rep.hz)) <= tol);
    const bad = tmp.filter((x) => !good.includes(x));
    out.push(good);
    if (bad.length) {
      const rest = splitByRep(bad, tol);
      out.push(...rest);
    }
  }
  return out;
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files = (await fs.readdir(MANIFEST_DIR)).filter((f) => f.endsWith('.csv')).sort((a, b) => a.localeCompare(b));

  const bars: Bar[] = [];
  const missingAudio: string[] = [];
  const audioIndexByScale = new Map<string, Awaited<ReturnType<typeof listAudioFileMap>>>();

  for (const file of files) {
    const text = await fs.readFile(path.join(MANIFEST_DIR, file), 'utf8');
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error(`${file}: ${parsed.errors[0].message}`);
    const headers = parsed.meta.fields ?? [];
    for (const col of reqCols) if (!headers.includes(col)) throw new Error(`${file}: missing required column '${col}'`);

    for (const row of parsed.data) {
      for (const col of reqCols) {
        if (!(row[col] ?? '').toString().trim()) throw new Error(`${file}:${row.bar_id}: missing '${col}'`);
      }

      const barId = row.bar_id.trim();
      const scaleId = deriveScaleId(row.edo ?? '', file);
      if (!audioIndexByScale.has(scaleId)) {
        audioIndexByScale.set(scaleId, await listAudioFileMap(scaleId));
      }

      const preferred = `${barId}.wav`;
      const audioIndex = audioIndexByScale.get(scaleId)!;
      const fileName = audioIndex.byName.get(preferred) ?? audioIndex.byLower.get(preferred.toLowerCase()) ?? preferred;
      const audioPath = `audio/${scaleId}/${fileName}`;

      try {
        await fs.access(path.join(ROOT, audioPath));
      } catch {
        missingAudio.push(audioPath);
      }

      const edoVal = normalizeScaleId(row.edo) === 'harmonic' ? 'harmonic' : Number(row.edo);
      bars.push({
        barId,
        scaleId,
        instrumentId: row.instrument_id.trim(),
        edo: edoVal === 'harmonic' || Number.isNaN(edoVal) ? (scaleId === 'harmonic' ? 'harmonic' : Number(scaleId.replace(/edo$/, ''))) : edoVal,
        step: Number(row.step),
        stepName: row.step_name.trim(),
        centsFromStep0: Number(row.cents_from_step0),
        ratioToStep0: row.ratio_to_step0.trim(),
        hz: Number(row.freq_if_step0_is_C),
        audioPath,
      });
    }
  }

  const validBars = bars.map((b) => BarSchema.parse(b));
  const barsById = new Map(validBars.map((b) => [b.barId, b]));
  const allBarsSorted = [...validBars].sort((a, b) => a.hz - b.hz || a.barId.localeCompare(b.barId));

  const scaleIds = [...new Set(validBars.map((b) => b.scaleId))].sort((a, b) => {
    if (a === 'harmonic') return 1;
    if (b === 'harmonic') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const scales = scaleIds.map((sid) => {
    const scaleBars = validBars.filter((b) => b.scaleId === sid).sort((a, b) => a.step - b.step || a.barId.localeCompare(b.barId));
    const edo = sid === 'harmonic' ? 'harmonic' : Number((sid.match(/^(\d+)edo$/)?.[1] ?? Number.NaN));
    return {
      scaleId: sid,
      title: sid === 'harmonic' ? 'Harmonic Series' : `${Number.isFinite(edo) ? edo : sid}-EDO`,
      edo: sid === 'harmonic' ? 'harmonic' : (Number.isFinite(edo) ? edo : sid),
      bars: scaleBars.map((b) => b.barId),
      stepsTotal: scaleBars.length,
    };
  });

  const instruments = [...new Set(validBars.map((b) => b.instrumentId))]
    .sort((a, b) => a.localeCompare(b))
    .map((instrumentId) => ({
      instrumentId,
      label: instrumentId,
      scales: [...new Set(validBars.filter((b) => b.instrumentId === instrumentId).map((b) => b.scaleId))].sort() as ScaleId[],
    }));

  const clustersByTolerance = Object.fromEntries(
    TOLS.map((tol) => {
      const groups = splitByRep(allBarsSorted, tol).map((membersRaw) => {
        const members = membersRaw.map((m) => m.barId).sort((a, b) => a.localeCompare(b));
        const repBarId = members[0];
        const repHz = barsById.get(repBarId)!.hz;
        const cents = members.map((m) => centsDiff(barsById.get(m)!.hz, repHz));
        const hzVals = members.map((m) => barsById.get(m)!.hz);
        return {
          groupId: `tol${tol}-${repBarId}`,
          repBarId,
          repHz,
          members,
          stats: {
            minHz: Math.min(...hzVals),
            maxHz: Math.max(...hzVals),
            meanHz: hzVals.reduce((a, b) => a + b, 0) / hzVals.length,
            maxCentsSpread: Math.max(...cents) - Math.min(...cents),
            count: members.length,
          },
        };
      });
      return [String(tol), groups];
    }),
  ) as Record<'5' | '15' | '30', unknown>;

  const pitchIndex = {
    allBarsSorted: allBarsSorted.map((b) => b.barId),
    clustersByTolerance,
    toleranceCentsPresets: [...TOLS],
  };

  const repoVersion = (await fs.readFile(path.join(ROOT, '.git', 'HEAD'), 'utf8').catch(() => '')).trim() || undefined;

  await fs.writeFile(path.join(DATA_DIR, 'bars.json'), `${JSON.stringify(allBarsSorted, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'scales.json'), `${JSON.stringify(scales, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'instruments.json'), `${JSON.stringify(instruments, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'pitch_index.json'), `${JSON.stringify(pitchIndex, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'buildInfo.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), repoVersion, tolerancesCents: [...TOLS], algorithm: 'adjacency-cluster with lexicographic representative revalidation split' }, null, 2)}\n`);

  if (missingAudio.length) {
    console.warn(`Missing audio (${missingAudio.length}):`);
    console.warn(missingAudio.join('\n'));
    if (process.env.STRICT_AUDIO === '1') process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
