/**
 * Jarvis Core Configuration
 */

import { JarvisConfig } from '../../../shared/types/index.js';

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
