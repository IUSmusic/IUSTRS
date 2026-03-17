import type { DetectedEvent } from '@ius/shared-types';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function midiToNoteName(midi: number): string {
  const name = NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function estimateKey(events: DetectedEvent[]): string {
  if (events.length === 0) return 'C major';

  const counts = new Array(12).fill(0);
  for (const event of events) counts[event.pitchMidi % 12] += 1;
  const best = counts.indexOf(Math.max(...counts));
  return `${NAMES[best]} major`;
}

export function estimateMeter(_events: DetectedEvent[]): string {
  return '4/4';
}

export function estimateChordLabel(windowEvents: DetectedEvent[]): string | undefined {
  if (windowEvents.length < 2) return undefined;

  const pcs = [...new Set(windowEvents.map((event) => event.pitchMidi % 12))].sort((a, b) => a - b);
  const root = pcs[0];
  const hasMaj3 = pcs.includes((root + 4) % 12);
  const hasMin3 = pcs.includes((root + 3) % 12);
  const has5 = pcs.includes((root + 7) % 12);

  if (hasMaj3 && has5) return `${NAMES[root]}`;
  if (hasMin3 && has5) return `${NAMES[root]}m`;
  return NAMES[root];
}
