import React, { useMemo, useRef, useState } from 'react';
import { AudioEngine } from '@ius/audio-engine';
import { MidiEngine } from '@ius/midi-engine';
import { estimateChordLabel, estimateKey, estimateMeter, midiToNoteName } from '@ius/music-theory';
import { ScoreRenderer } from '@ius/score-renderer';
import { downloadFile, exportJson, exportMusicXml, exportTxt } from '@ius/exporters';
import { groupChordWindows, quantizeEvent } from '@ius/transcription-engine';
import type { DetectionSettings, DetectedEvent, TransportState } from '@ius/shared-types';
import { HybridPitchAdapter } from './lib/hybridPitchAdapter';

const defaultSettings: DetectionSettings = {
  noiseGate: 0.03,
  latencyMs: 120,
  inputGain: 1,
  confidenceThreshold: 0.25,
  quantizationStrength: 0.7,
  profile: 'voice'
};

export function App() {
  const [settings, setSettings] = useState<DetectionSettings>(defaultSettings);
  const [events, setEvents] = useState<DetectedEvent[]>([]);
  const [transport, setTransport] = useState<TransportState>({
    isListening: false,
    bpm: 120,
    meter: '4/4',
    key: 'C major'
  });
  const [audioLevel, setAudioLevel] = useState(0);
  const [midiInputs, setMidiInputs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState('Ready. Primary backend: Basic Pitch compatibility mode (TensorFlow.js). Secondary fallback: basic-pitch-ts TensorFlow.js. Emergency fallback: heuristic autocorrelation.');

  const audioEngine = useRef(new AudioEngine({ adapter: new HybridPitchAdapter({ onStatus: setBackendStatus }) }));
  const midiEngine = useRef(new MidiEngine());

  const pushEvent = (raw: DetectedEvent) => {
    const event = quantizeEvent(raw, settings, transport.bpm);
    setEvents((prev) => {
      const next = [...prev, event].slice(-200);
      setTransport((state) => ({ ...state, key: estimateKey(next), meter: estimateMeter(next) }));
      return next;
    });
  };

  const chordGroups = useMemo(() => groupChordWindows(events), [events]);
  const lastChord = useMemo(() => estimateChordLabel(chordGroups.length ? chordGroups[chordGroups.length - 1] : []), [chordGroups]);

  const startAudio = async () => {
    try {
      setErrorMessage(null);
      await audioEngine.current.start(settings, pushEvent, setAudioLevel);
      setTransport((state) => ({ ...state, isListening: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start microphone capture.';
      setTransport((state) => ({ ...state, isListening: false }));
      setAudioLevel(0);
      setErrorMessage(message);
    }
  };

  const stopAudio = async () => {
    await audioEngine.current.stop();
    setTransport((state) => ({ ...state, isListening: false }));
    setAudioLevel(0);
  };

  const connectMidi = async () => {
    try {
      setErrorMessage(null);
      const names = await midiEngine.current.connect(pushEvent);
      setMidiInputs(names);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not connect MIDI.';
      setErrorMessage(message);
    }
  };

  const exportAll = (kind: 'json' | 'txt' | 'musicxml') => {
    if (kind === 'json') downloadFile('transcription.json', exportJson(events), 'application/json');
    if (kind === 'txt') downloadFile('transcription.txt', exportTxt(events), 'text/plain');
    if (kind === 'musicxml') downloadFile('transcription.musicxml', exportMusicXml(events), 'application/xml');
  };

  return (
    <div className="app-shell">
      <aside className="panel left-panel">
        <div className="brand-header">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logoofficial.png`} alt="IUS logo" />
          <div>
            <div className="h1 brand-title">Live Music Transcription</div>
            <div className="small">Offline-first notation capture for voice, MIDI, guitar, violin, and keyboard workflows.</div>
          </div>
        </div>

        <div className="h2">Transport</div>
        <div className="grid2">
          <button className="btn primary" onClick={() => void startAudio()}>Start Mic</button>
          <button className="btn" onClick={() => void stopAudio()}>Stop Mic</button>
          <button className="btn primary" onClick={() => void connectMidi()}>Connect MIDI</button>
          <button className="btn" onClick={() => setEvents([])}>Clear</button>
        </div>

        {errorMessage ? <div className="warning">{errorMessage}</div> : null}

        <div className="h2">Input settings</div>
        <Control label="Audio backend">
          <div className="small">Primary: Basic Pitch compatibility mode over the bundled TF.js model. Secondary fallback: direct TF.js model access. Emergency fallback: heuristic autocorrelation.</div>
          <div className="mono" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{backendStatus}</div>
        </Control>
        <Control label={`Noise gate ${settings.noiseGate.toFixed(2)}`}>
          <input type="range" min="0" max="0.2" step="0.005" value={settings.noiseGate} onChange={(event) => setSettings({ ...settings, noiseGate: Number(event.target.value) })} />
        </Control>
        <Control label={`Latency / buffer ${settings.latencyMs}ms`}>
          <input type="range" min="40" max="400" step="10" value={settings.latencyMs} onChange={(event) => setSettings({ ...settings, latencyMs: Number(event.target.value) })} />
        </Control>
        <Control label={`Input gain ${settings.inputGain.toFixed(2)}`}>
          <input type="range" min="0.5" max="3" step="0.05" value={settings.inputGain} onChange={(event) => setSettings({ ...settings, inputGain: Number(event.target.value) })} />
        </Control>
        <Control label={`Confidence threshold ${settings.confidenceThreshold.toFixed(2)}`}>
          <input type="range" min="0.05" max="1" step="0.05" value={settings.confidenceThreshold} onChange={(event) => setSettings({ ...settings, confidenceThreshold: Number(event.target.value) })} />
        </Control>
        <Control label={`Quantization strength ${settings.quantizationStrength.toFixed(2)}`}>
          <input type="range" min="0" max="1" step="0.05" value={settings.quantizationStrength} onChange={(event) => setSettings({ ...settings, quantizationStrength: Number(event.target.value) })} />
        </Control>
        <Control label="Instrument preset">
          <select value={settings.profile} onChange={(event) => setSettings({ ...settings, profile: event.target.value as DetectionSettings['profile'] })}>
            <option value="voice">Voice / humming</option>
            <option value="violin">Violin</option>
            <option value="guitar">Guitar</option>
            <option value="keyboard">Keyboard</option>
            <option value="polyphonic-hint">Polyphonic hint</option>
          </select>
        </Control>

        <div className="h2">Bundled model assets</div>
        <div className="card col">
          <div className="small">Compatibility backend model:</div>
          <div className="mono">apps/web/public/models/basic-pitch-ts/model.json</div>
          <div className="small">Bundled TF.js asset:</div>
          <div className="mono">apps/web/public/models/basic-pitch-ts/model.json</div>
        </div>

        <div className="h2">Export</div>
        <div className="grid2">
          <button className="btn" onClick={() => exportAll('json')}>JSON</button>
          <button className="btn" onClick={() => exportAll('txt')}>TXT</button>
          <button className="btn" onClick={() => exportAll('musicxml')}>MusicXML</button>
          <button className="btn" onClick={() => window.print()}>PDF</button>
        </div>
      </aside>

      <main className="panel center-panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="h1">Score View</div>
            <div className="small">VexFlow renderer on the same DetectedEvent pipeline.</div>
          </div>
          <div className="row">
            <span className="badge">Key: {transport.key}</span>
            <span className="badge">Meter: {transport.meter}</span>
            <span className="badge">BPM: {transport.bpm}</span>
          </div>
        </div>
        <div className="score-wrap">
          <ScoreRenderer events={events} />
        </div>
      </main>

      <aside className="panel right-panel">
        <div className="h1">Detection</div>
        <div className="card col">
          <div><span className="label">Mic level:</span> <span className="value">{audioLevel.toFixed(3)}</span></div>
          <div><span className="label">Listening:</span> <span className="value">{transport.isListening ? 'Yes' : 'No'}</span></div>
          <div><span className="label">Audio backend:</span> <span className="value">Hybrid (compat TF.js → TF.js → heuristic fallback)</span></div>
          <div><span className="label">MIDI inputs:</span> <span className="value">{midiInputs.length ? midiInputs.join(', ') : 'None connected yet'}</span></div>
          <div><span className="label">Last chord:</span> <span className="value">{lastChord ?? '—'}</span></div>
          <div><span className="label">Events captured:</span> <span className="value">{events.length}</span></div>
        </div>

        <div className="h2">Recent notes</div>
        <table className="table">
          <thead>
            <tr><th>Note</th><th>Dur</th><th>Conf</th><th>Src</th></tr>
          </thead>
          <tbody>
            {[...events].slice(-12).reverse().map((event) => (
              <tr key={event.id}>
                <td>{midiToNoteName(event.pitchMidi)}</td>
                <td>{Math.round(event.durationMs)}ms</td>
                <td>{event.confidence.toFixed(2)}</td>
                <td>{event.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>

      <section className="panel bottom-panel">
        <div className="h1">Timeline</div>
        <div className="timeline">
          {[...events].slice(-48).map((event) => (
            <div key={event.id} className="timeline-bar" style={{ height: `${Math.max(10, Math.min(110, event.durationMs / 8))}px` }} title={`${midiToNoteName(event.pitchMidi)} ${Math.round(event.durationMs)}ms`} />
          ))}
        </div>
        <div className="small">Bottom lane is ready for waveform, onset markers, and beat grid next.</div>
      </section>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}
