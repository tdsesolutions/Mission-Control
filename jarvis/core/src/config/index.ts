/**
 * Jarvis Core Configuration
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';
import { JarvisConfig } from '../../../shared/types/index.js';

// Load .env HERE, not in index.ts: ES module imports are hoisted, so this
// module executes before index.ts's body. Loading anywhere later means every
// process.env read below happens before the file is parsed (latent bug found
// in Phase 5). Resolved from cwd — npm runs scripts with cwd = jarvis/core.
const envCandidates = [
  join(process.cwd(), '..', '.env'), // jarvis/.env (documented location)
  join(process.cwd(), '.env'),       // jarvis/core/.env
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
}

const isDevelopment = process.env.NODE_ENV !== 'production';

export const config: JarvisConfig = {
  version: process.env.JARVIS_VERSION || '1.0.0',
  environment: isDevelopment ? 'development' : 'production',
  
  ports: {
    core: parseInt(process.env.JARVIS_CORE_PORT || '3010', 10),
    desktop: parseInt(process.env.JARVIS_DESKTOP_PORT || '3011', 10),
    memory: parseInt(process.env.JARVIS_MEMORY_PORT || '3012', 10),
    monitor: parseInt(process.env.JARVIS_MONITOR_PORT || '3015', 10),
  },
  
  missionControl: {
    url: process.env.MISSION_CONTROL_URL || 'http://localhost:3002',
    apiKey: process.env.MISSION_CONTROL_API_KEY || '',
  },

  // Optional shared-secret auth for the Core API (CURRENT_PHASE defect 5).
  // Empty (default) = open on localhost, current behavior. When set, all
  // /api/v1/* endpoints require it; /health stays open for monitors.
  security: {
    coreToken: process.env.KIAROS_CORE_TOKEN || '',
  },
  
  openclaw: {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789',
  },
  
  features: {
    orbMode: process.env.FEATURE_ORB_MODE !== 'false',
    sphereMode: process.env.FEATURE_SPHERE_MODE !== 'false',
    waveMode: process.env.FEATURE_WAVE_MODE !== 'false',
    hudMode: process.env.FEATURE_HUD_MODE !== 'false',
    ambientMode: process.env.FEATURE_AMBIENT_MODE !== 'false',
  },

  // Conversation intelligence. Provider selection is configuration only —
  // Kiaros is never hardcoded to a provider or model (Phase 5 mandate).
  llm: {
    provider: (process.env.KIAROS_LLM_PROVIDER || 'auto') as
      'auto' | 'anthropic' | 'openai-compatible' | 'none',
    model: process.env.KIAROS_LLM_MODEL || '',
    maxTokens: parseInt(process.env.KIAROS_LLM_MAX_TOKENS || '1024', 10),
    timeoutMs: parseInt(process.env.KIAROS_LLM_TIMEOUT_MS || '30000', 10),
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    openaiCompat: {
      baseUrl: process.env.OPENAI_COMPAT_BASE_URL || '',
      apiKey: process.env.OPENAI_COMPAT_API_KEY || '',
      model: process.env.OPENAI_COMPAT_MODEL || '',
    },
  },
};

export const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3011',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3011',
  'http://0.0.0.0:3011',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  // Allow all localhost origins for development
  /http:\/\/localhost:\d+/,
  /http:\/\/127\.0\.0\.1:\d+/,
];

export const port = config.ports.core;
