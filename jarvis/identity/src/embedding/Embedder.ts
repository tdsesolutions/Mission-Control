/**
 * Speaker-embedding abstraction. The real implementation wraps sherpa-onnx
 * (fully local ONNX inference); tests inject a deterministic mock. Mirrors
 * the LLMProvider pattern from Core: never hardcode the engine.
 */

import { createRequire } from 'module';
import fs from 'fs';

export interface SpeakerEmbedder {
  /** Embedding dimensionality. */
  readonly dim: number;
  /** Compute a speaker embedding for mono float PCM at the given rate. */
  embed(samples: Float32Array, sampleRate: number): Promise<Float32Array>;
}

interface SherpaExtractorLike {
  dim: number;
  createStream(): {
    acceptWaveform(w: { samples: Float32Array; sampleRate: number }): void;
    inputFinished(): void;
  };
  compute(stream: unknown): Float32Array | number[];
}

/**
 * sherpa-onnx is a native CommonJS addon; createRequire keeps us ESM.
 * Loading is lazy and failure is explicit: the service reports
 * modelLoaded=false and returns 503s rather than pretending.
 */
export class SherpaEmbedder implements SpeakerEmbedder {
  private extractor: SherpaExtractorLike;
  readonly dim: number;

  constructor(modelPath: string) {
    if (!fs.existsSync(modelPath)) {
      throw new Error(`speaker model not found at ${modelPath} — run \`npm run download-model\``);
    }
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sherpa = require('sherpa-onnx-node');
    this.extractor = new sherpa.SpeakerEmbeddingExtractor({
      model: modelPath,
      numThreads: 2,
      debug: false,
    });
    this.dim = this.extractor.dim;
  }

  async embed(samples: Float32Array, sampleRate: number): Promise<Float32Array> {
    const stream = this.extractor.createStream();
    stream.acceptWaveform({ samples, sampleRate });
    // Flush the feature pipeline: half a second of tail silence plus
    // inputFinished(), or the extractor computes on a truncated utterance
    // (which destroyed discrimination — owner scored below impostor).
    stream.acceptWaveform({ samples: new Float32Array(Math.floor(sampleRate / 2)), sampleRate });
    stream.inputFinished();
    const raw = this.extractor.compute(stream);
    return raw instanceof Float32Array ? raw : Float32Array.from(raw);
  }
}
