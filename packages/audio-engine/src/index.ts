import type {
  DetectionSettings,
  DetectedEvent,
  FrameFeature,
  PitchFrame,
  PitchModelAdapter
} from '@ius/shared-types';

export type AudioEngineOptions = {
  adapter: PitchModelAdapter;
  frameSize?: number;
};

type ActiveNote = {
  pitchMidi: number;
  startedAtMs: number;
  lastSeenAtMs: number;
  confidence: number;
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private frameSize: number;
  private active: ActiveNote | null = null;
  private isRunning = false;
  private isTicking = false;
  private onLevel: ((n: number) => void) | null = null;

  constructor(private readonly options: AudioEngineOptions) {
    this.frameSize = options.frameSize ?? 2048;
  }

  async start(
    settings: DetectionSettings,
    onEvent: (event: DetectedEvent) => void,
    onLevel: (n: number) => void
  ) {
    if (this.isRunning) return;

    try {
      await this.options.adapter.init();

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.ctx = new AudioContext({
        latencyHint: settings.latencyMs < 100 ? 'interactive' : 'balanced'
      });

      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = this.frameSize;
      this.analyser.smoothingTimeConstant = 0.1;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = settings.inputGain;
      this.source.connect(this.gainNode).connect(this.analyser);

      this.isRunning = true;
      this.onLevel = onLevel;
      this.scheduleTick(settings, onEvent, onLevel);
    } catch (error) {
      this.isRunning = false;
      await this.stop();
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.isTicking = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.source?.disconnect();
    this.gainNode?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.gainNode = null;
    this.analyser = null;
    this.active = null;
    this.onLevel?.(0);
    this.onLevel = null;
    await this.ctx?.close();
    this.ctx = null;
    if (this.options.adapter.dispose) {
      await this.options.adapter.dispose();
    }
  }

  private scheduleTick(
    settings: DetectionSettings,
    onEvent: (event: DetectedEvent) => void,
    onLevel: (n: number) => void
  ) {
    const timeData = new Float32Array(this.analyser?.fftSize ?? this.frameSize);

    const tick = async () => {
      if (!this.isRunning || !this.analyser || !this.ctx) return;
      if (this.isTicking) {
        this.raf = requestAnimationFrame(() => {
          void tick();
        });
        return;
      }

      this.isTicking = true;
      try {
        this.analyser.getFloatTimeDomainData(timeData);
        const rms = Math.sqrt(timeData.reduce((sum, x) => sum + x * x, 0) / timeData.length);
        onLevel(rms);

        const feature: FrameFeature = {
          timestampMs: performance.now(),
          rms,
          samples: new Float32Array(timeData),
          sampleRate: this.ctx.sampleRate
        };

        try {
          const frames = await this.options.adapter.infer(feature);
          const best = selectBestFrame(frames, settings.confidenceThreshold, settings.noiseGate, rms);
          this.reconcile(best, settings, onEvent);
        } catch {
          this.reconcile(null, settings, onEvent);
        }
      } finally {
        this.isTicking = false;
        if (this.isRunning) {
          this.raf = requestAnimationFrame(() => {
            void tick();
          });
        }
      }
    };

    void tick();
  }

  private reconcile(
    frame: PitchFrame | null,
    settings: DetectionSettings,
    onEvent: (event: DetectedEvent) => void
  ) {
    const now = performance.now();
    const holdMs = Math.max(90, settings.latencyMs);

    if (frame) {
      if (!this.active) {
        this.active = {
          pitchMidi: frame.pitchMidi,
          startedAtMs: now,
          lastSeenAtMs: now,
          confidence: frame.confidence
        };
        return;
      }

      const samePitch = Math.abs(this.active.pitchMidi - frame.pitchMidi) < 0.6;
      if (!samePitch) {
        this.emitActive(now, onEvent);
        this.active = {
          pitchMidi: frame.pitchMidi,
          startedAtMs: now,
          lastSeenAtMs: now,
          confidence: frame.confidence
        };
        return;
      }

      this.active.pitchMidi = frame.pitchMidi;
      this.active.lastSeenAtMs = now;
      this.active.confidence = Math.max(this.active.confidence, frame.confidence);
      return;
    }

    if (this.active && now - this.active.lastSeenAtMs > holdMs) {
      this.emitActive(now, onEvent);
      this.active = null;
    }
  }

  private emitActive(now: number, onEvent: (event: DetectedEvent) => void) {
    if (!this.active) return;

    const roundedMidi = Math.round(this.active.pitchMidi);
    onEvent({
      id: crypto.randomUUID(),
      source: 'audio',
      pitchMidi: roundedMidi,
      frequencyHz: 440 * Math.pow(2, (roundedMidi - 69) / 12),
      startMs: this.active.startedAtMs,
      durationMs: Math.max(60, now - this.active.startedAtMs),
      confidence: Math.max(0.01, Math.min(0.999, this.active.confidence)),
      staff: roundedMidi >= 60 ? 0 : 1
    });
  }
}

function selectBestFrame(
  frames: PitchFrame[],
  confidenceThreshold: number,
  noiseGate: number,
  rms: number
): PitchFrame | null {
  if (rms < noiseGate) return null;

  const voiced = frames
    .filter((frame) => frame.voiced)
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!voiced) return null;
  if (voiced.confidence < confidenceThreshold) return null;
  if (Number.isNaN(voiced.pitchMidi)) return null;
  return voiced;
}
