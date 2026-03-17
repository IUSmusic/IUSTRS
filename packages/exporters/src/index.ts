import type { DetectedEvent } from '@ius/shared-types';
import { midiToNoteName } from '@ius/music-theory';

export function exportJson(events: DetectedEvent[]) {
  return JSON.stringify(events, null, 2);
}

export function exportTxt(events: DetectedEvent[]) {
  return events
    .map((event) =>
      `${event.startMs}\t${event.durationMs}\t${midiToNoteName(event.pitchMidi)}\t${event.confidence.toFixed(2)}\t${event.source}`
    )
    .join('\n');
}

export function exportMusicXml(events: DetectedEvent[]) {
  const notes = events.map((event) => {
    const noteName = midiToNoteName(event.pitchMidi);
    const octave = Math.floor(event.pitchMidi / 12) - 1;
    const accidental = noteName.includes('#') ? '<alter>1</alter>' : noteName.includes('b') ? '<alter>-1</alter>' : '';
    const step = noteName.replace(/\d+/g, '').replace('#', '').replace('b', '');

    return `<note><pitch><step>${step[0]}</step>${accidental}<octave>${octave}</octave></pitch><duration>${Math.max(1, Math.round(event.durationMs / 120))}</duration></note>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list><part id="P1"><measure number="1">${notes}</measure></part></score-partwise>`;
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
