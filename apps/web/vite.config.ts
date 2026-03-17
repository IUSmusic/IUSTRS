import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@ius/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@ius/audio-engine': path.resolve(__dirname, '../../packages/audio-engine/src'),
      '@ius/midi-engine': path.resolve(__dirname, '../../packages/midi-engine/src'),
      '@ius/transcription-engine': path.resolve(__dirname, '../../packages/transcription-engine/src'),
      '@ius/music-theory': path.resolve(__dirname, '../../packages/music-theory/src'),
      '@ius/score-renderer': path.resolve(__dirname, '../../packages/score-renderer/src'),
      '@ius/exporters': path.resolve(__dirname, '../../packages/exporters/src')
    }
  }
});
