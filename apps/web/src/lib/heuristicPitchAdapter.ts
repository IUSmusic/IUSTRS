import type { FrameFeature, PitchFrame, PitchModelAdapter } from '@ius/shared-types';

type StatusSink = (message: string) => void;

type HeuristicPitchAdapterOptions = {
  onStatus?: StatusSink;
};

export class HeuristicPitchAdapter implements PitchModelAdapter {
  readonly name = 'heuristic-autocorrelation';

  constructor(private readonly options: HeuristicPitchAdapterOptions = {}) {}

  async init(): Promise<void> {
    this.options.onStatus?.(
      'Emergency fallback loaded: heuristic autocorrelation. This keeps microphone transcription usable when ONNX and TF.js model loading fail.',
    );
  }

  async infer(frame: FrameFeature): Promise<PitchFrame[]> {
    const frequencyHz = autoCorrelate(frame.samples, frame.sampleRate);
    if (frequencyHz <= 0) return [];

    const pitchMidi = 69 + 12 * Math.log2(frequencyHz / 440);
    const confidence = clamp01(Math.min(1, frame.rms * 12));

    return [
      {
        timestampMs: frame.timestampMs,
        pitchMidi,
        confidence,
        voiced: confidence >= 0.1,
      },
    ];
  }
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  let rms = 0;
  for (let index = 0; index < buffer.length; index += 1) rms += buffer[index] * buffer[index];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return -1;

  let bestOffset = -1;
  let bestCorrelation = 0;

  for (let offset = 8; offset < Math.min(1000, buffer.length - 1); offset += 1) {
    let correlation = 0;
    for (let index = 0; index < buffer.length - offset; index += 1) {
      correlation += Math.abs(buffer[index] - buffer[index + offset]);
    }
    correlation = 1 - correlation / (buffer.length - offset);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  return bestCorrelation > 0.9 && bestOffset > 0 ? sampleRate / bestOffset : -1;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
