import type { DetectedEvent } from '@ius/shared-types';

type ActiveNote = { startMs: number; velocity: number };

export class MidiEngine {
  private access: MIDIAccess | null = null;
  private active = new Map<number, ActiveNote>();

  async connect(onEvent: (event: DetectedEvent) => void): Promise<string[]> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI is not supported in this browser.');
    }

    this.access = await navigator.requestMIDIAccess();
    const names: string[] = [];

    for (const input of this.access.inputs.values()) {
      names.push(input.name ?? 'MIDI Input');
      input.onmidimessage = (message) => {
        const data = message.data;
        if (!data || data.length < 2) return;
        const status = data[0];
        const note = data[1];
        const velocity = data[2] ?? 0;
        const command = status & 0xf0;
        const now = performance.now();

        if (command === 0x90 && velocity > 0) {
          this.active.set(note, { startMs: now, velocity });
        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
          const active = this.active.get(note);
          if (!active) return;

          this.active.delete(note);
          onEvent({
            id: crypto.randomUUID(),
            source: 'midi',
            pitchMidi: note,
            startMs: active.startMs,
            durationMs: Math.max(60, now - active.startMs),
            velocity: active.velocity,
            confidence: 1,
            staff: note >= 60 ? 0 : 1
          });
        }
      };
    }

    return names;
  }
}
