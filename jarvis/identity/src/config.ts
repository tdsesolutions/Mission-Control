/**
 * Identity Service configuration.
 * Port 3013 is the slot AI_SERVICE_PORT_REGISTRY.md reserves for local
 * voice processing. Everything here is local-only: the service binds to
 * 127.0.0.1 and no audio or embedding ever leaves the machine.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(__dirname, '..', '..');

// Shared jarvis/.env (same file Core reads) so keys/config stay in one place.
dotenv.config({ path: path.join(serviceRoot, '.env') });

export const config = {
  port: Number(process.env.IDENTITY_PORT || 3013),
  host: '127.0.0.1',
  /** Voiceprints + audit trail. Lives under jarvis/.data (gitignored). */
  dataDir:
    process.env.IDENTITY_DATA_DIR ||
    path.join(serviceRoot, '.data', 'identity'),
  /** Speaker-embedding ONNX model (see scripts/download-model.sh). */
  modelPath:
    process.env.IDENTITY_MODEL_PATH ||
    path.join(serviceRoot, 'identity', 'models', 'campplus_en_voxceleb.onnx'),
  enrollment: {
    minSamples: 3,
    maxSamples: 8,
    /** Seconds of audio below which a sample is rejected as too short.
        Short utterances produce unstable embeddings (verified empirically:
        a ~2s choppy phrase scored 0.61 vs its own speaker's centroid where
        full sentences score 0.93+). */
    minSampleSeconds: 2.5,
    /** Enrollment sessions expire after this many ms of inactivity. */
    sessionTtlMs: 10 * 60 * 1000,
  },
  verification: {
    /** Cosine-similarity threshold bounds; calibration clamps into these. */
    thresholdFloor: 0.35,
    thresholdCeiling: 0.6,
    /** Fallback when calibration is degenerate (too few/identical samples). */
    thresholdDefault: 0.45,
  },
} as const;
