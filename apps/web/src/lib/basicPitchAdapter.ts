import type { FrameFeature, PitchFrame, PitchModelAdapter } from '@ius/shared-types';
import { BasicPitchTsAdapter } from './basicPitchTsAdapter';

type StatusSink = (message: string) => void;

type BasicPitchAdapterOptions = {
  modelUrl?: string;
  expectedSampleRate?: number;
  onStatus?: StatusSink;
};

const DEFAULT_MODEL_URL = '/models/basic-pitch-ts/model.json';

export class BasicPitchAdapter implements PitchModelAdapter {
  readonly name = 'spotify-basic-pitch-compatible';
  private readonly delegate: BasicPitchTsAdapter;
  private initialized = false;

  constructor(private readonly options: BasicPitchAdapterOptions = {}) {
    this.delegate = new BasicPitchTsAdapter({
      modelUrl: options.modelUrl ?? DEFAULT_MODEL_URL,
      expectedSampleRate: options.expectedSampleRate,
      onStatus: (message) => this.options.onStatus?.(message),
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.options.onStatus?.(
      'Primary backend loaded: Basic Pitch compatibility mode (TensorFlow.js).',
    );
    await this.delegate.init();
    this.initialized = true;
  }

  async infer(frame: FrameFeature): Promise<PitchFrame[]> {
    if (!this.initialized) await this.init();
    return this.delegate.infer(frame);
  }

  async dispose(): Promise<void> {
    await this.delegate.dispose();
    this.initialized = false;
  }
}
