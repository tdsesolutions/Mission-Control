/**
 * Kiaros Speaker Identity Service — port 3013.
 * Local-only (binds 127.0.0.1). Computes speaker embeddings on-device and
 * verifies utterances against the owner's enrolled voiceprint. No audio,
 * embedding, or score ever leaves this machine.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { SherpaEmbedder, SpeakerEmbedder } from './embedding/Embedder.js';
import { VoiceprintStore } from './store/VoiceprintStore.js';
import { AuditLog } from './audit.js';
import { createRoutes } from './api/routes.js';

let embedder: SpeakerEmbedder | null = null;
let modelError: string | undefined;
try {
  embedder = new SherpaEmbedder(config.modelPath);
} catch (err) {
  modelError = err instanceof Error ? err.message : String(err);
  console.error(`[identity] model load failed — running degraded: ${modelError}`);
}

const app = express();
app.use(helmet());
app.use(cors({ origin: [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/] }));

app.use(
  '/api/v1/identity',
  createRoutes({
    embedder,
    modelError,
    store: new VoiceprintStore(config.dataDir),
    audit: new AuditLog(config.dataDir),
  })
);

process.on('unhandledRejection', (reason) => {
  console.error('[identity] unhandled rejection:', reason);
});

app.listen(config.port, config.host, () => {
  console.log(
    `[identity] Speaker Identity Service on http://${config.host}:${config.port} ` +
      `(model: ${embedder ? `loaded, dim=${embedder.dim}` : 'MISSING — degraded'})`
  );
});
