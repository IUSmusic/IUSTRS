
# Live Music Transcription App

**Demo Version:**
https://iusmusic.github.io/TRS-Demo/

Local web app for capturing live musical input from microphone or MIDI, turning it into note events, previewing the result as notation, and exporting the session for downstream use.

This project is organized as a small TypeScript monorepo with a React + Vite frontend and shared packages for audio capture, MIDI handling, transcription logic, music theory helpers, score rendering, and exporters.

- captures live microphone input in the browser
- accepts live MIDI input from connected devices
- detects note events and builds a running event timeline
- estimates key, meter, and recent chord context from captured notes
- renders a live score-style view in the browser
- exports sessions as JSON, TXT, and basic MusicXML
- works locally in the browser without requiring a backend service


This repository is an early-stage MVP / prototype. The app is usable for local experimentation and internal evaluation, but it is not yet a production transcription system.

Current implementation highlights:

- React 18 + TypeScript + Vite frontend
- Web Audio API microphone capture
- Web MIDI API device input
- hybrid pitch-detection pipeline:
  - Basic Pitch compatibility mode over a bundled TensorFlow.js model
  - direct TensorFlow.js fallback backend
  - heuristic autocorrelation emergency fallback
- lightweight built-in score renderer for live notation preview
- local export helpers for JSON, TXT, and MusicXML
- GitHub Pages deployment workflow included

## Repository structure

text
apps/
  web/                    Frontend application
packages/
  audio-engine/           Microphone capture and note event reconciliation
  exporters/              JSON / TXT / MusicXML export helpers
  midi-engine/            MIDI device input handling
  music-theory/           Note naming, key, meter, and chord helpers
  score-renderer/         Live notation-style renderer
  shared-types/           Shared TypeScript types
  transcription-engine/   Quantization and grouping helpers


## Getting started

### Requirements

- Node.js 22 or newer
- npm
- a modern Chromium-based browser is recommended for the best Web Audio / Web MIDI support

### Local development

```bash
npm install
npm run typecheck
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Production build

```bash
npm install
npm run build
```

The built frontend is emitted to:

```text
apps/web/dist
```

## Running with Docker

Build and serve the production bundle with Docker:

```bash
docker compose up --build
```

The app will be served on:

```text
http://localhost:8080
```

## Usage

1. open the app in a supported browser
2. allow microphone access if you want live audio transcription
3. click **Start Mic** to begin microphone capture
4. click **Connect MIDI** to attach available MIDI inputs
5. adjust the input controls:
   - noise gate
   - latency / buffer
   - input gain
   - confidence threshold
   - quantization strength
   - instrument preset
6. watch the score preview, recent notes, and timeline update live
7. export the captured session as JSON, TXT, or MusicXML

## Bundled assets

This repository includes bundled TensorFlow.js model assets used by the current audio backend.

Relevant path:

```text
apps/web/public/models/basic-pitch-ts/model.json
```

## Deployment

A GitHub Actions workflow is included for GitHub Pages deployment.

After pushing to GitHub:

1. open **Settings → Pages**
2. set **Build and deployment** to **GitHub Actions**
3. push to `main` or run the workflow manually

The Vite base path is configured as `./` so the built app can be deployed without hard-coding a repository-specific base path.

## Notes and limitations

- microphone transcription quality depends heavily on input signal quality, room noise, and instrument profile
- browser security rules require user permission for microphone and MIDI access
- browser MIDI support varies by browser and operating system
- the current notation renderer is optimized for fast live preview, not full engraving fidelity
- MusicXML export is intentionally simple and should be treated as a starting point for downstream editing
- the current app is local-first and does not include user accounts, cloud sync, or backend persistence

## License

This repository is **source-available**, not open source.

It is licensed under the **I/US Source-Available License 1.0**. You may review the source code and use it for limited private internal evaluation, but redistribution, public derivative distribution, and commercial use are not permitted without prior written permission.

See [LICENSE](./LICENSE) or [LICENSE.md](./LICENSE.md) for the full terms.

## Copyright

Copyright (c) 2026 Pezhman Farhangi
I/US Music

## Contact

For licensing requests, commercial rights, redistribution requests, or permission to use protected brand assets, prior written permission must be obtained from I/US Music.

