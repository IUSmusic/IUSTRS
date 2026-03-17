import React, { useMemo } from 'react';
import type { DetectedEvent } from '@ius/shared-types';

export function ScoreRenderer({ events }: { events: DetectedEvent[] }) {
  const recent = useMemo(() => [...events].slice(-16), [events]);
  const trebleEvents = useMemo(
    () => recent.filter((event) => (event.staff ?? 0) === 0),
    [recent],
  );
  const bassEvents = useMemo(
    () => recent.filter((event) => (event.staff ?? 0) === 1),
    [recent],
  );

  if (recent.length === 0) {
    return (
      <div style={{ minHeight: 320, color: '#9fb0da', display: 'grid', placeItems: 'center' }}>
        Play or sing into the app to see notes appear here.
      </div>
    );
  }

  return (
    <div style={{ minHeight: 320, display: 'grid', gap: 20 }}>
      <StaffLane label="Treble" events={trebleEvents} />
      <StaffLane label="Bass" events={bassEvents} />
    </div>
  );
}

function StaffLane({ label, events }: { label: string; events: DetectedEvent[] }) {
  return (
    <div>
      <div style={{ color: '#9fb0da', fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          border: '1px solid rgba(159, 176, 218, 0.3)',
          borderRadius: 12,
          minHeight: 120,
          padding: 12,
          display: 'grid',
          alignItems: 'center',
          background:
            'repeating-linear-gradient(to bottom, rgba(159,176,218,0.18) 0, rgba(159,176,218,0.18) 1px, transparent 1px, transparent 22px)',
        }}
      >
        {events.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  minWidth: 56,
                  padding: '8px 10px',
                  borderRadius: 999,
                  background: 'rgba(122, 162, 247, 0.18)',
                  border: '1px solid rgba(122, 162, 247, 0.35)',
                  color: '#e8ecf6',
                  textAlign: 'center',
                }}
                title={`${midiToLabel(event.pitchMidi)} • ${Math.round(event.durationMs)}ms • ${event.confidence.toFixed(2)}`}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>{midiToLabel(event.pitchMidi)}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{toDurationToken(event.durationMs)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#9fb0da', fontSize: 13 }}>No notes in this staff yet.</div>
        )}
      </div>
    </div>
  );
}

function midiToLabel(midi: number): string {
  const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `${names[pitchClass]}${octave}`;
}

function toDurationToken(durationMs: number): string {
  if (durationMs >= 900) return 'half';
  if (durationMs >= 350) return 'quarter';
  return 'eighth';
}
