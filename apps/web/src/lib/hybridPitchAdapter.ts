import type { FrameFeature, PitchFrame, PitchModelAdapter } from '@ius/shared-types';
import { BasicPitchAdapter } from './basicPitchAdapter';
import { BasicPitchTsAdapter } from './basicPitchTsAdapter';
import { HeuristicPitchAdapter } from './heuristicPitchAdapter';

type StatusSink = (message: string) => void;

type HybridPitchAdapterOptions = {
  onStatus?: StatusSink;
};

export class HybridPitchAdapter implements PitchModelAdapter {
  readonly name = 'hybrid-basic-pitch';
  private readonly backends: PitchModelAdapter[];
  private activeIndex = -1;

  constructor(private readonly options: HybridPitchAdapterOptions = {}) {
    this.backends = [
      new BasicPitchAdapter({ onStatus: options.onStatus }),
      new BasicPitchTsAdapter({ onStatus: options.onStatus }),
      new HeuristicPitchAdapter({ onStatus: options.onStatus }),
    ];
  }

  async init(): Promise<void> {
    if (this.activeIndex >= 0) return;

    const failures: string[] = [];
    for (let index = 0; index < this.backends.length; index += 1) {
      const backend = this.backends[index];
      try {
        await backend.init();
        this.activeIndex = index;
        this.options.onStatus?.(`Active audio backend: ${backend.name}.`);
        return;
      } catch (error) {
        failures.push(formatError(error));
      }
    }

    throw new Error(`No audio backend could be initialized. ${failures.join(' | ')}`);
  }

  async infer(frame: FrameFeature): Promise<PitchFrame[]> {
    if (this.activeIndex < 0) await this.init();

    for (let index = this.activeIndex; index < this.backends.length; index += 1) {
      const backend = this.backends[index];
      try {
        const result = await backend.infer(frame);
        if (index !== this.activeIndex) {
          this.activeIndex = index;
          this.options.onStatus?.(`Active audio backend switched to ${backend.name}.`);
        }
        return result;
      } catch (error) {
        await backend.dispose?.();
        this.options.onStatus?.(`${backend.name} failed during inference: ${formatError(error)}`);
      }
    }

    return [];
  }

  async dispose(): Promise<void> {
    await Promise.all(this.backends.map(async (backend) => backend.dispose?.()));
    this.activeIndex = -1;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown backend error.';
}
