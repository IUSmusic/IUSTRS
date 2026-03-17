# Live Music Transcription App

A local-first React + TypeScript app for live MIDI/audio transcription, notation preview, and export.

## Stack
- React + TypeScript + Vite
- Web Audio API
- Web MIDI API
- VexFlow for fast live notation
- Spotify Basic Pitch official ONNX model as the primary audio backend
- Spotify basic-pitch-ts TensorFlow.js model as the fallback backend
- Local-first event schema shared across all engines

## Start
```bash
npm install
npm run typecheck
npm run dev
```

## Included model assets
These are already bundled in the repo:
- `apps/web/public/models/basic-pitch/basic_pitch.onnx`
- `apps/web/public/models/basic-pitch-ts/model.json`
- `apps/web/public/models/basic-pitch-ts/group1-shard1of1.bin`

## GitHub Pages
This repo includes a GitHub Pages workflow. After pushing to GitHub:
1. Open **Settings → Pages**
2. Under **Build and deployment**, select **GitHub Actions**
3. Push to `main`

The Vite base path is set to `./` so the build works on GitHub Pages without needing a repo-name-specific base path.

## Current MVP
- MIDI input transcription
- Microphone transcription scaffold with bundled Spotify Basic Pitch models
- Live event timeline
- VexFlow notation preview
- Controls for noise gate, latency, gain, confidence, quantization
- JSON/TXT/MusicXML export stubs

## Notes
- The primary path uses the official Spotify Basic Pitch ONNX model bundled from the uploaded `basic-pitch-0.3.0.zip`.
- The fallback path uses the official `basic-pitch-ts-1.0.1` TensorFlow.js model bundled from the uploaded zip.
- Basic Pitch expects larger overlapping audio windows than a simple autocorrelation detector, so the adapter buffers microphone frames before inference.
