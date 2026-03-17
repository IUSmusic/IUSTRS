import * as tf from '@tensorflow/tfjs';
import type { Tensor } from '@tensorflow/tfjs';
import type { FrameFeature, PitchFrame, PitchModelAdapter } from '@ius/shared-types';

type StatusSink = (message: string) => void;

type BasicPitchTsAdapterOptions = {
  modelUrl?: string;
  expectedSampleRate?: number;
  onStatus?: StatusSink;
};

type TensorMap = Record<string, Tensor>;
type NamedTensor = { name: string; tensor: Tensor };
type TensorPrediction = Tensor | Tensor[] | TensorMap;

const DEFAULT_MODEL_URL = '/models/basic-pitch-ts/model.json';
const DEFAULT_SAMPLE_RATE = 22050;
const AUDIO_N_SAMPLES = 22050 * 2 - 256;
const FFT_HOP = 256;
const N_OVERLAPPING_FRAMES = 30;
const N_OVERLAP_OVER_2 = Math.floor(N_OVERLAPPING_FRAMES / 2);
const OVERLAP_LENGTH_FRAMES = N_OVERLAPPING_FRAMES * FFT_HOP;
const HOP_SIZE = AUDIO_N_SAMPLES - OVERLAP_LENGTH_FRAMES;
const MIDI_MIN = 21;
const MIDI_MAX = 108;

export class BasicPitchTsAdapter implements PitchModelAdapter {
  readonly name = 'spotify-basic-pitch-ts';
  private model: tf.GraphModel | null = null;
  private outputLayoutReported = false;
  private sampleBuffer: Float32Array<ArrayBufferLike> = new Float32Array(0);

  constructor(private readonly options: BasicPitchTsAdapterOptions = {}) {}

  async init(): Promise<void> {
    if (this.model) return;

    this.model = await tf.loadGraphModel(this.options.modelUrl ?? DEFAULT_MODEL_URL);
    this.report(
      `Fallback backend loaded: Basic Pitch TS. Inputs: ${this.model.inputs
        .map((input) => input.name)
        .join(', ') || 'none'}. Outputs: ${this.model.outputs
        .map((output) => output.name)
        .join(', ') || 'none'}.`,
    );
  }

  async infer(frame: FrameFeature): Promise<PitchFrame[]> {
    if (!this.model) throw new Error('BasicPitchTsAdapter not initialized.');

    const expectedRate = this.options.expectedSampleRate ?? DEFAULT_SAMPLE_RATE;
    const resampled = normalizeInput(
      resampleToModelRate(frame.samples, frame.sampleRate, expectedRate),
    );

    this.sampleBuffer = appendSamples(this.sampleBuffer, resampled, AUDIO_N_SAMPLES);
    if (this.sampleBuffer.length < AUDIO_N_SAMPLES) return [];

    const windowSamples = copyFloat32(this.sampleBuffer.subarray(0, AUDIO_N_SAMPLES));
    this.sampleBuffer = copyFloat32(
      this.sampleBuffer.subarray(Math.min(HOP_SIZE, this.sampleBuffer.length)),
    );

    const input = tf.tensor(windowSamples, [1, windowSamples.length, 1], 'float32');

    let prediction: TensorPrediction;
    try {
      prediction = this.model.predict(input) as TensorPrediction;
    } finally {
      input.dispose();
    }

    const namedOutputs = normalizeTfOutputs(prediction);

    if (!this.outputLayoutReported) {
      this.outputLayoutReported = true;
      this.report(
        `TF output layout: ${namedOutputs
          .map(({ name, tensor }) => `${name}[${tensor.shape.join('x') || '?'}]`)
          .join(', ')}`,
      );
    }

    const frameOut = await decodeTfOutputs(namedOutputs, frame.timestampMs);

    for (const item of namedOutputs) item.tensor.dispose();

    return frameOut ? [frameOut] : [];
  }

  async dispose(): Promise<void> {
    this.model?.dispose();
    this.model = null;
    this.sampleBuffer = new Float32Array(0);
  }

  private report(message: string) {
    this.options.onStatus?.(message);
    console.info(`[BasicPitchTsAdapter] ${message}`);
  }
}

function normalizeTfOutputs(prediction: TensorPrediction): NamedTensor[] {
  if (Array.isArray(prediction)) {
    return prediction.map((tensor, index) => ({
      name: `output_${index}`,
      tensor,
    }));
  }

  if (isTensor(prediction)) {
    return [{ name: 'output_0', tensor: prediction }];
  }

  return Object.entries(prediction).map(([name, tensor]) => ({ name, tensor }));
}

function isTensor(value: TensorPrediction): value is Tensor {
  return value instanceof tf.Tensor;
}

async function decodeTfOutputs(
  outputs: NamedTensor[],
  timestampMs: number,
): Promise<PitchFrame | null> {
  const note = pickTensor(outputs, ['Identity_1', 'frames', 'frame']);
  const onset = pickTensor(outputs, ['Identity_2', 'onsets', 'onset']);
  const contour = pickTensor(outputs, ['Identity', 'contours', 'contour']);
  const preferred = note ?? contour ?? onset ?? outputs[0];

  if (!preferred) return null;

  const preferredSlice = await latestPitchSlice(preferred.tensor);
  const noteSlice = note ? await latestPitchSlice(note.tensor) : null;
  const onsetSlice = onset ? await latestPitchSlice(onset.tensor) : null;
  const contourSlice = contour ? await latestPitchSlice(contour.tensor) : null;

  const noteBest = findPeak(noteSlice?.values ?? []);
  const onsetBest = findPeak(onsetSlice?.values ?? []);
  const contourBest = findPeak(contourSlice?.values ?? []);
  const best = noteBest ?? contourBest ?? onsetBest ?? findPeak(preferredSlice.values);

  if (!best) return null;

  const midi = noteBest
    ? mapBinToMidi(noteBest.index, noteSlice?.pitchBins ?? preferredSlice.pitchBins)
    : contourBest
      ? mapBinToMidi(contourBest.index, contourSlice?.pitchBins ?? preferredSlice.pitchBins)
      : mapBinToMidi(best.index, preferredSlice.pitchBins);

  const confidenceCandidates: Array<number | undefined> = [
    noteBest?.value,
    onsetBest?.value,
    contourBest?.value,
  ];
  const confidenceParts = confidenceCandidates.filter(
    (value): value is number => typeof value === 'number',
  );

  const confidence = clamp01(
    confidenceParts.length
      ? confidenceParts.reduce((sum, value) => sum + squashActivation(value), 0) /
          confidenceParts.length
      : squashActivation(best.value),
  );

  return { timestampMs, pitchMidi: midi, confidence, voiced: confidence >= 0.12 };
}

async function latestPitchSlice(
  tensor: Tensor,
): Promise<{ values: number[]; pitchBins: number }> {
  const raw = await tensor.data();
  const values = Array.from(raw as ArrayLike<number>);
  const shape = tensor.shape;
  const pitchBins = shape.length ? shape[shape.length - 1]! : values.length;
  const frameBins = shape.length >= 2 ? shape[shape.length - 2]! : 1;
  const effectiveFrameIndex = Math.max(0, frameBins - 1 - N_OVERLAP_OVER_2);
  const sliceStart = Math.max(0, effectiveFrameIndex * pitchBins);

  return {
    values: values.slice(sliceStart, sliceStart + pitchBins),
    pitchBins,
  };
}

function pickTensor(
  outputs: NamedTensor[],
  patterns: string[],
): NamedTensor | undefined {
  const lowered = patterns.map((pattern) => pattern.toLowerCase());
  return outputs.find(({ name }) =>
    lowered.some((pattern) => name.toLowerCase().includes(pattern)),
  );
}

function appendSamples(
  existing: Float32Array<ArrayBufferLike>,
  incoming: Float32Array<ArrayBufferLike>,
  maxRetained: number,
): Float32Array<ArrayBufferLike> {
  const combined = new Float32Array(existing.length + incoming.length);
  combined.set(existing, 0);
  combined.set(incoming, existing.length);
  return combined.length <= maxRetained
    ? combined
    : copyFloat32(combined.subarray(combined.length - maxRetained));
}

function normalizeInput(samples: Float32Array<ArrayBufferLike>): Float32Array<ArrayBufferLike> {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  if (max <= 1e-6) return copyFloat32(samples);

  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] / max;
  return out;
}

function resampleToModelRate(input: Float32Array<ArrayBufferLike>, fromRate: number, toRate: number): Float32Array<ArrayBufferLike> {
  if (fromRate === toRate) return copyFloat32(input);

  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    out[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }

  return out;
}

function copyFloat32(input: Float32Array<ArrayBufferLike>): Float32Array<ArrayBufferLike> {
  const out = new Float32Array(input.length);
  out.set(input);
  return out;
}

function findPeak(values: number[]): { index: number; value: number } | null {
  if (!values.length) return null;

  let bestIndex = 0;
  let bestValue = values[0];

  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > bestValue) {
      bestValue = values[i];
      bestIndex = i;
    }
  }

  return { index: bestIndex, value: bestValue };
}

function mapBinToMidi(index: number, binCount: number): number {
  if (binCount <= 1) return 60;
  if (binCount === 88) return MIDI_MIN + index;

  const ratio = index / (binCount - 1);
  return Math.round(MIDI_MIN + ratio * (MIDI_MAX - MIDI_MIN));
}

function squashActivation(value: number): number {
  if (value >= 0 && value <= 1) return value;
  return 1 / (1 + Math.exp(-value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
