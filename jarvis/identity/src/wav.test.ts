import { describe, it, expect } from 'vitest';
import { parseWav, buildWav } from './wav.js';

function sine(freq: number, seconds: number, rate = 16000): Float32Array {
  const out = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = 0.6 * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

describe('wav round trip', () => {
  it('build → parse preserves rate, duration, and content', () => {
    const samples = sine(440, 2);
    const parsed = parseWav(buildWav(samples, 16000));
    expect(parsed.sampleRate).toBe(16000);
    expect(parsed.durationSeconds).toBeCloseTo(2, 2);
    expect(parsed.samples.length).toBe(samples.length);
    expect(parsed.samples[100]).toBeCloseTo(samples[100], 3);
  });

  it('rejects non-WAV data', () => {
    expect(() => parseWav(Buffer.from('definitely not audio, just text padding to 44+ bytes.'))).toThrow(/RIFF/);
  });

  it('rejects stereo', () => {
    const wav = buildWav(sine(440, 1), 16000);
    wav.writeUInt16LE(2, 22); // channels = 2
    expect(() => parseWav(wav)).toThrow(/channel/);
  });

  it('rejects non-PCM encodings', () => {
    const wav = buildWav(sine(440, 1), 16000);
    wav.writeUInt16LE(3, 20); // IEEE float
    expect(() => parseWav(wav)).toThrow(/encoding/);
  });
});
