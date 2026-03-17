export type SourceKind = 'midi' | 'audio' | 'manual';
export type InstrumentProfile = 'voice' | 'violin' | 'guitar' | 'keyboard' | 'polyphonic-hint';

export type DetectedEvent = {
  id: string;
  source: SourceKind;
  pitchMidi: number;
  frequencyHz?: number;
  startMs: number;
  durationMs: number;
  velocity?: number;
  confidence: number;
  voice?: number;
  staff?: number;
  spelling?: string;
  articulation?: string[];
  chordLabel?: string;
};

export type TransportState = {
  isListening: boolean;
  bpm: number;
  meter: string;
  key: string;
};

export type DetectionSettings = {
  noiseGate: number;
  latencyMs: number;
  inputGain: number;
  confidenceThreshold: number;
  quantizationStrength: number;
  profile: InstrumentProfile;
};

export type FrameFeature = {
  timestampMs: number;
  rms: number;
  samples: Float32Array;
  sampleRate: number;
};

export type PitchFrame = {
  timestampMs: number;
  pitchMidi: number;
  confidence: number;
  voiced: boolean;
};

export type PitchModelAdapter = {
  name: string;
  init(): Promise<void>;
  infer(frame: FrameFeature): Promise<PitchFrame[]>;
  dispose?(): Promise<void>;
};
