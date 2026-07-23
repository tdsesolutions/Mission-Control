/**
 * API tests with a deterministic mock embedder: the "speaker" is the tone
 * frequency of the audio, mapped onto an embedding direction via its
 * zero-crossing rate. Same tone → same voice; distant tone → different
 * voice. Exercises the full HTTP surface without the ONNX model.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { AddressInfo } from 'net';
import http from 'http';
import { createRoutes } from './routes.js';
import { SpeakerEmbedder } from '../embedding/Embedder.js';
import { VoiceprintStore } from '../store/VoiceprintStore.js';
import { AuditLog } from '../audit.js';
import { buildWav } from '../wav.js';

class ToneEmbedder implements SpeakerEmbedder {
  readonly dim = 4;
  async embed(samples: Float32Array): Promise<Float32Array> {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i - 1] < 0) !== (samples[i] < 0)) crossings++;
    }
    const zcr = crossings / samples.length;
    const a = zcr * 40;
    return Float32Array.from([Math.cos(a), Math.sin(a), Math.cos(2 * a), Math.sin(2 * a)]);
  }
}

function tone(freq: number, seconds = 3, rate = 16000): Buffer {
  const s = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < s.length; i++) s[i] = 0.6 * Math.sin((2 * Math.PI * freq * i) / rate);
  return buildWav(s, rate);
}

let server: http.Server;
let base: string;
let dataDir: string;

async function post(pathname: string, body?: Buffer | object): Promise<{ status: number; json: any }> {
  const isBuf = Buffer.isBuffer(body);
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': isBuf ? 'audio/wav' : 'application/json' },
    body: isBuf ? new Uint8Array(body as Buffer) : body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-test-'));
  const app = express();
  app.use(
    '/api/v1/identity',
    createRoutes({
      embedder: new ToneEmbedder(),
      store: new VoiceprintStore(dataDir),
      audit: new AuditLog(dataDir),
    })
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/identity`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('identity API', () => {
  it('reports health with model loaded and nothing enrolled', async () => {
    const res = await fetch(`${base}/health`);
    const body = (await res.json()) as any;
    expect(body.data.modelLoaded).toBe(true);
    expect(body.data.enrolled.desktop).toBe(false);
  });

  it('verify before enrollment reports unenrolled, speaker unknown', async () => {
    const { json } = await post('/verify?source=test', tone(220));
    expect(json.data.enrolled).toBe(false);
    expect(json.data.speaker).toBe('unknown');
  });

  it('rejects samples that are too short', async () => {
    const { json: start } = await post('/enroll/start', {});
    const { status, json } = await post(`/enroll/sample/${start.data.sessionId}`, tone(220, 0.5));
    expect(status).toBe(400);
    expect(json.error).toMatch(/too short/);
  });

  it('refuses to finish with too few samples', async () => {
    const { json: start } = await post('/enroll/start', {});
    await post(`/enroll/sample/${start.data.sessionId}`, tone(220));
    const { status, json } = await post(`/enroll/finish/${start.data.sessionId}`, {});
    expect(status).toBe(400);
    expect(json.error).toMatch(/at least 3/);
  });

  it('full enroll → verify: owner tone accepted, impostor tone rejected', async () => {
    const { json: start } = await post('/enroll/start', {});
    const id = start.data.sessionId;
    expect(start.data.phrases.length).toBeGreaterThanOrEqual(3);

    // "Owner" = tones clustered near 220 Hz (natural variation between takes).
    for (const f of [220, 224, 218]) {
      const { status } = await post(`/enroll/sample/${id}`, tone(f));
      expect(status).toBe(200);
    }
    const { json: finish } = await post(`/enroll/finish/${id}`, {});
    expect(finish.success).toBe(true);
    expect(finish.data.threshold).toBeGreaterThanOrEqual(0.35);
    expect(finish.data.threshold).toBeLessThanOrEqual(0.6);

    const owner = await post('/verify?source=test', tone(221));
    expect(owner.json.data.speaker).toBe('owner');
    expect(owner.json.data.score).toBeGreaterThan(owner.json.data.threshold);

    const impostor = await post('/verify?source=test', tone(700));
    expect(impostor.json.data.speaker).toBe('unknown');
    expect(impostor.json.data.score).toBeLessThan(impostor.json.data.threshold);
  });

  it('persists the voiceprint and appends to the audit trail', async () => {
    expect(fs.existsSync(path.join(dataDir, 'voiceprint-desktop.json'))).toBe(true);
    const audit = fs.readFileSync(path.join(dataDir, 'identity-audit.jsonl'), 'utf8').trim().split('\n');
    const events = audit.map((l) => JSON.parse(l));
    expect(events.some((e) => e.event === 'enroll' && e.outcome === 'voiceprint_saved')).toBe(true);
    expect(events.some((e) => e.event === 'verify' && e.outcome === 'owner')).toBe(true);
    // Privacy: audit lines carry scores only — never audio or embeddings.
    expect(Object.keys(events[events.length - 1])).not.toContain('samples');
  });

  it('deletes the voiceprint', async () => {
    const res = await fetch(`${base}/voiceprint/desktop`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const verify = await post('/verify?source=test', tone(221));
    expect(verify.json.data.enrolled).toBe(false);
  });

  it('returns 503 everywhere (except health) when the model is missing', async () => {
    const app = express();
    app.use(
      '/api/v1/identity',
      createRoutes({
        embedder: null,
        modelError: 'model file missing',
        store: new VoiceprintStore(dataDir),
        audit: new AuditLog(dataDir),
      })
    );
    const s = app.listen(0, '127.0.0.1');
    await new Promise((r) => s.once('listening', r));
    const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/v1/identity`;
    const health = (await (await fetch(`${b}/health`)).json()) as any;
    expect(health.data.modelLoaded).toBe(false);
    const res = await fetch(`${b}/enroll/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(503);
    await new Promise((r) => s.close(r));
  });
});
