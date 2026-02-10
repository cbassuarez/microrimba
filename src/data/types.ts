export type ScaleId = '5edo' | '7edo' | '8edo' | '9edo' | 'harmonic' | string;
export type InstrumentId = string;
export type BarId = string;

export type Bar = {
  barId: BarId;
  scaleId: ScaleId;
  instrumentId: InstrumentId;
  edo: number | 'harmonic';
  step: number;
  stepName: string;
  centsFromStep0: number;
  ratioToStep0: string;
  ratioToRef: number;
  hz: number;
  audioPath: string;
};

export type Scale = {
  scaleId: ScaleId;
  title: string;
  edo: number | 'harmonic';
  bars: BarId[];
  stepsTotal: number;
};

export type PitchIndexEntry = { barId: BarId; hz: number; scaleId: ScaleId; instrumentId: InstrumentId };

export type PitchGroup = {
  groupId: string;
  repBarId: BarId;
  repHz: number;
  members: BarId[];
  stats: { minHz: number; maxHz: number; meanHz: number; maxCentsSpread: number; count: number };
};

export type InstrumentsJson = { instrumentId: string; label: string; scales: ScaleId[] }[];
export type PitchIndexJson = {
  allBarsSorted: BarId[];
  clustersByTolerance: Record<'5' | '15' | '30', PitchGroup[]>;
  toleranceCentsPresets: number[];
};
export type BuildInfoJson = {
  generatedAt: string;
  repoVersion?: string;
  tolerancesCents: number[];
  algorithm: string;
  refBarId?: string;
  refPitchHz?: number;
  ratioReference?: string;
};
