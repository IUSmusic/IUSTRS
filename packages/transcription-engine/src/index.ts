import type { DetectionSettings, DetectedEvent } from '@ius/shared-types';

export function quantizeEvent(event: DetectedEvent, settings: DetectionSettings, bpm = 120): DetectedEvent {
  const beatMs = 60000 / bpm;
  const grid = beatMs / 4;
  const strength = settings.quantizationStrength;

  const snap = (value: number) => {
    const target = Math.round(value / grid) * grid;
    return value + (target - value) * strength;
  };

  const startMs = snap(event.startMs);
  const durationMs = Math.max(grid / 2, snap(event.durationMs));

  return { ...event, startMs, durationMs };
}

export function groupChordWindows(events: DetectedEvent[], toleranceMs = 60): DetectedEvent[][] {
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs);
  const groups: DetectedEvent[][] = [];

  for (const event of sorted) {
    const last = groups.length ? groups[groups.length - 1] : undefined;
    if (!last || Math.abs(last[0].startMs - event.startMs) > toleranceMs) {
      groups.push([event]);
    } else {
      last.push(event);
    }
  }

  return groups;
}
