import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import { z } from 'zod';

const ROOT = path.resolve(path.join(import.meta.dirname, '..'));
const MANIFEST_DIR = path.join(ROOT, 'manifest');
const DATA_DIR = path.join(ROOT, 'public', 'data');
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
  ratioErrorCents: number;
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
  ratioErrorCents: z.number(),
  hz: z.number(),
  audioPath: z.string(),
});

const centsDiff = (a: number, b: number) => 1200 * Math.log2(a / b);

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function cents(x: number): number {
  return 1200 * Math.log2(x);
}

function bestSimpleFraction(x: number, maxDen = 64) {
  let best = { p: 1, q: 1, err: Infinity, score: Infinity };

  for (let q = 1; q <= maxDen; q += 1) {
    const p0 = Math.max(1, Math.round(x * q));
    for (const pTry of [p0 - 1, p0, p0 + 1]) {
      if (pTry <= 0) continue;

      let p = pTry;
      let qq = q;
      const g = gcd(p, qq);
      p /= g;
      qq /= g;

      const approx = p / qq;
      const err = cents(x / approx);
      const aerr = Math.abs(err);
      const score = aerr + 0.08 * qq;

      if (score < best.score) best = { p, q: qq, err, score };
    }
  }

  return {
    frac: `${best.p}/${best.q}`,
    approx: best.p / best.q,
    errCents: best.err,
  };
}

function normalizeFracString(frac: string): string {
  const s = String(frac).trim();
  if (!s.includes('/')) return `${s}/1`;
  const [a, b] = s.split('/').map((x) => x.trim());
  if (!a || !b) return `${a || '1'}/${b || '1'}`;
  return `${a}/${b}`;
}

function prettyInstrumentLabel(scaleId: string, edo: number | 'harmonic') {
  if (scaleId === 'harmonic') return 'C Harmonic Marimba';
  if (typeof edo === 'number') return `${edo}-EDO Marimba`;
  const parsed = Number(scaleId.match(/^(\d+)edo$/)?.[1] ?? Number.NaN);
  return Number.isFinite(parsed) ? `${parsed}-EDO Marimba` : 'Marimba';
}

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
        ratioErrorCents: 0,
        hz: Number(row.freq_if_step0_is_C),
        audioPath,
      });
    }
  }

  const validBars = bars.map((b) => BarSchema.parse(b));

  const scaleInstrumentGroups = new Map<string, Bar[]>();
  for (const bar of validBars) {
    const key = `${bar.scaleId}::${bar.instrumentId}`;
    const current = scaleInstrumentGroups.get(key);
    if (current) current.push(bar);
    else scaleInstrumentGroups.set(key, [bar]);
  }

  const barsWithRatios = [...scaleInstrumentGroups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, groupBars]) => {
      const isHarmonic = groupBars[0]?.scaleId === 'harmonic' || groupBars[0]?.edo === 'harmonic';
      const barsSorted = [...groupBars].sort((a, b) => a.step - b.step || a.barId.localeCompare(b.barId));

      if (isHarmonic) {
        return barsSorted.map((bar) => {
          const partial = Number(bar.barId.match(/harmonic-(\d+)$/i)?.[1] ?? bar.stepName.match(/H(\d+)/i)?.[1] ?? Math.max(1, bar.step + 1));
          const ratioToStep0 = normalizeFracString(bar.barId.toLowerCase() === 'harmonic-001' ? '1/1' : `${Math.max(1, partial)}/1`);
          if (!ratioToStep0.includes('/')) {
            throw new Error(`Invalid ratioToStep0 '${ratioToStep0}' for ${bar.barId}`);
          }
          return {
            ...bar,
            ratioToStep0,
            ratioErrorCents: 0,
          };
        });
      }

      const stepZero = barsSorted.find((bar) => bar.step === 0);
      let refHz = stepZero?.hz;
      if (!refHz) {
        const fallback = barsSorted[0];
        refHz = fallback.hz;
        console.warn(`Missing step=0 for group ${fallback.scaleId}/${fallback.instrumentId}; using ${fallback.barId} as reference`);
      }

      return barsSorted.map((bar) => {
        const x = bar.hz / refHz;
        const quant = bestSimpleFraction(x, 64);
        const ratioToStep0 = normalizeFracString(quant.frac);
        if (!ratioToStep0.includes('/')) {
          throw new Error(`Invalid ratioToStep0 '${ratioToStep0}' for ${bar.barId}`);
        }
        return {
          ...bar,
          ratioToStep0,
          ratioErrorCents: quant.errCents,
        };
      });
    });
  const refBarId = 'harmonic-001';
  const refHz = barsWithRatios.find((b) => b.barId === refBarId)?.hz;
  if (!refHz) throw new Error('Missing ref bar harmonic-001 for ratio reference');

  const barsWithRef = barsWithRatios.map((bar) => ({
    ...bar,
    ratioToRef: bar.hz / refHz,
  }));
  const barsById = new Map(barsWithRef.map((b) => [b.barId, b]));
  const allBarsSorted = [...barsWithRef].sort((a, b) => a.hz - b.hz || a.barId.localeCompare(b.barId));

  const scaleIds = [...new Set(barsWithRef.map((b) => b.scaleId))].sort((a, b) => {
    if (a === 'harmonic') return 1;
    if (b === 'harmonic') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const scales = scaleIds.map((sid) => {
    const scaleBars = barsWithRef.filter((b) => b.scaleId === sid).sort((a, b) => a.step - b.step || a.barId.localeCompare(b.barId));
    const edo = sid === 'harmonic' ? 'harmonic' : Number((sid.match(/^(\d+)edo$/)?.[1] ?? Number.NaN));
    return {
      scaleId: sid,
      title: sid === 'harmonic' ? 'Harmonic Series' : `${Number.isFinite(edo) ? edo : sid}-EDO`,
      edo: sid === 'harmonic' ? 'harmonic' : (Number.isFinite(edo) ? edo : sid),
      bars: scaleBars.map((b) => b.barId),
      stepsTotal: scaleBars.length,
    };
  });

  const instrumentGroups = new Map<string, Bar[]>();
  for (const bar of barsWithRef) {
    const key = `${bar.scaleId}::${bar.instrumentId}`;
    const current = instrumentGroups.get(key);
    if (current) current.push(bar);
    else instrumentGroups.set(key, [bar]);
  }

  const instruments = [...instrumentGroups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, groupBars]) => {
      const ordered = [...groupBars].sort((a, b) => a.step - b.step || a.barId.localeCompare(b.barId));
      const stepZero = ordered.find((bar) => bar.step === 0);
      const defaultBar = stepZero ?? [...ordered].sort((a, b) => a.barId.localeCompare(b.barId))[0];
      const first = ordered[0];
      return {
        instrumentId: first.instrumentId,
        label: prettyInstrumentLabel(first.scaleId, first.edo),
        scaleId: first.scaleId,
        edo: first.edo,
        defaultStep0BarId: defaultBar.barId,
        barIdsInOrder: ordered.map((bar) => bar.barId),
      };
    });

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

  for (const bar of allBarsSorted) {
    if (!bar.ratioToStep0.includes('/')) {
      throw new Error(`Invalid ratioToStep0 '${bar.ratioToStep0}' for ${bar.barId}`);
    }
  }

  await fs.writeFile(path.join(DATA_DIR, 'bars.json'), `${JSON.stringify(allBarsSorted, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'scales.json'), `${JSON.stringify(scales, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'instruments.json'), `${JSON.stringify(instruments, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'pitch_index.json'), `${JSON.stringify(pitchIndex, null, 2)}\n`);
  await fs.writeFile(path.join(DATA_DIR, 'buildInfo.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    repoVersion,
    tolerancesCents: [...TOLS],
    algorithm: 'adjacency-cluster with lexicographic representative revalidation split',
    refBarId,
    refPitchHz: refHz,
    ratioReference: 'all ratios relative to harmonic-001',
  }, null, 2)}\n`);

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
