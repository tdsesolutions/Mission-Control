/**
 * Minimal RIFF/WAVE parser for the formats the service accepts:
 * PCM 16-bit signed little-endian, mono. Any sample rate (the embedding
 * runtime resamples internally). Rejects everything else honestly rather
 * than guessing.
 */

export interface ParsedWav {
  samples: Float32Array;
  sampleRate: number;
  durationSeconds: number;
}

export function parseWav(buf: Buffer): ParsedWav {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }

  let fmt: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let dataOffset = -1;
  let dataLength = 0;

  // Walk chunks (fmt may not be the first chunk; LIST/INFO chunks are common).
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = Math.min(size, buf.length - body);
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }

  if (!fmt) throw new Error('missing fmt chunk');
  if (dataOffset < 0) throw new Error('missing data chunk');
  if (fmt.audioFormat !== 1) throw new Error(`unsupported WAV encoding ${fmt.audioFormat} (need PCM)`);
  if (fmt.bitsPerSample !== 16) throw new Error(`unsupported bit depth ${fmt.bitsPerSample} (need 16)`);
  if (fmt.channels !== 1) throw new Error(`unsupported channel count ${fmt.channels} (need mono)`);

  const sampleCount = Math.floor(dataLength / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
  }

  return {
    samples,
    sampleRate: fmt.sampleRate,
    durationSeconds: sampleCount / fmt.sampleRate,
  };
}

/** Build a PCM16 mono WAV from float samples — used by tests. */
export function buildWav(samples: Float32Array, sampleRate: number): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
