/**
 * Jarvis Shared Constants
 * Core constants for Jarvis AI Executive System
 */

// ============================================================================
// Version & Identity
// ============================================================================

export const JARVIS_VERSION = '1.0.0';
export const JARVIS_NAME = 'Jarvis';
export const JARVIS_FULL_NAME = 'Jarvis AI Executive';
export const JARVIS_TAGLINE = 'Your AI Operating System';

// ============================================================================
// Service Ports (from AI Service Port Registry)
// ============================================================================

export const PORTS = {
  // Core Services
  OPENCLAW_GATEWAY: 18789,
  MISSION_CONTROL: 3002,
  JARVIS_CORE: 3010,
  
  // Extension Services
  JARVIS_DESKTOP: 3011,
  MEMORY_SERVICE: 3012,
  VOICE_SERVICE: 3013,
  COMPUTER_CONTROL: 3014,
  
  // Infrastructure Services
  SERVICE_MONITOR: 3015,
  NOTIFICATION_SERVICE: 3016,
} as const;

// ============================================================================
// Protected Ports (Website Development)
// ============================================================================

export const PROTECTED_PORTS = [
  3000,  // Next.js dev server
  3001,  // Alternative dev server
  5173,  // Vite dev server
  8000,  // Django, general backend
  8080,  // Alternative web server
] as const;

// ============================================================================
// API Endpoints
// ============================================================================

export const ENDPOINTS = {
  // Health
  HEALTH: '/health',
  
  // Core API
  API_V1: '/api/v1',
  
  // Jarvis Core
  STATUS: '/api/v1/status',
  STATE: '/api/v1/state',
  MODE: '/api/v1/mode',
  CONVERSATION: '/api/v1/conversation',
  TASKS: '/api/v1/tasks',
  PROJECTS: '/api/v1/projects',
  MEMORY: '/api/v1/memory',
  ACTIONS: '/api/v1/actions',
  EVENTS: '/api/v1/events',
  
  // Mission Control Integration
  MISSION_CONTROL_HEALTH: '/api/health',
  MISSION_CONTROL_TASKS: '/api/tasks',
  MISSION_CONTROL_PROJECTS: '/api/projects',
  
  // Gateway
  GATEWAY_HEALTH: '/health',
} as const;

// ============================================================================
// Timeouts & Intervals
// ============================================================================

export const TIMEOUTS = {
  HEALTH_CHECK: 5000,
  API_REQUEST: 30000,
  SERVICE_START: 60000,
  SERVICE_STOP: 30000,
  DELEGATION_TIMEOUT: 120000,
} as const;

export const INTERVALS = {
  HEALTH_CHECK: 30000,
  METRICS_COLLECTION: 60000,
  MEMORY_CLEANUP: 3600000,
  PROJECT_SYNC: 300000,
} as const;

// ============================================================================
// UI Constants
// ============================================================================

export const UI_MODES = {
  FACE: 'face',
  ORB: 'orb',
  SPHERE: 'sphere',
  WAVE: 'wave',
  HUD: 'hud',
  AMBIENT: 'ambient',
} as const;

export const UI_COLORS = {
  // Primary Palette
  PRIMARY: '#00D4FF',
  SECONDARY: '#7B61FF',
  ACCENT: '#FF6B6B',
  
  // Status Colors
  SUCCESS: '#00E676',
  WARNING: '#FFC107',
  ERROR: '#FF1744',
  INFO: '#2196F3',
  
  // Neutral Colors
  DARK: '#0A0A0F',
  DARKER: '#050508',
  LIGHT: '#FFFFFF',
  GRAY: '#8B8B9E',
  
  // Orb/Sphere Gradients
  ORB_CORE: '#00D4FF',
  ORB_GLOW: 'rgba(0, 212, 255, 0.3)',
  SPHERE_INNER: '#1A1A2E',
  SPHERE_OUTER: '#0F0F1A',
} as const;

export const ANIMATION = {
  DURATION_FAST: 150,
  DURATION_NORMAL: 300,
  DURATION_SLOW: 500,
  DURATION_ORB_PULSE: 2000,
  DURATION_WAVE_CYCLE: 3000,
  EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ============================================================================
// Memory Constants
// ============================================================================

export const MEMORY = {
  MAX_SHORT_TERM_ITEMS: 50,
  MAX_CONVERSATION_HISTORY: 100,
  RETENTION_DAYS: 30,
  COMPRESSION_THRESHOLD: 1000,
} as const;

// ============================================================================
// Task Constants
// ============================================================================

export const TASK = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 5000,
  DEFAULT_PRIORITY: 'medium' as const,
  AUTO_ARCHIVE_DAYS: 30,
} as const;

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  // Service Errors
  SERVICE_UNREACHABLE: 'JARVIS_001',
  SERVICE_UNHEALTHY: 'JARVIS_002',
  SERVICE_TIMEOUT: 'JARVIS_003',
  
  // API Errors
  API_INVALID_REQUEST: 'JARVIS_100',
  API_UNAUTHORIZED: 'JARVIS_101',
  API_NOT_FOUND: 'JARVIS_102',
  API_RATE_LIMITED: 'JARVIS_103',
  
  // Delegation Errors
  DELEGATION_FAILED: 'JARVIS_200',
  APPROVAL_REQUIRED: 'JARVIS_201',
  APPROVAL_DENIED: 'JARVIS_202',
  
  // Memory Errors
  MEMORY_READ_FAILED: 'JARVIS_300',
  MEMORY_WRITE_FAILED: 'JARVIS_301',
  MEMORY_CORRUPTED: 'JARVIS_302',
  
  // System Errors
  CONFIG_INVALID: 'JARVIS_400',
  INITIALIZATION_FAILED: 'JARVIS_401',
  UNKNOWN_ERROR: 'JARVIS_999',
} as const;

// ============================================================================
// Event Types
// ============================================================================

export const EVENT_TYPES = {
  // Service Events
  SERVICE_STARTED: 'service:started',
  SERVICE_STOPPED: 'service:stopped',
  SERVICE_HEALTHY: 'service:healthy',
  SERVICE_UNHEALTHY: 'service:unhealthy',
  
  // Task Events
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  
  // User Events
  USER_MESSAGE: 'user:message',
  JARVIS_RESPONSE: 'jarvis:response',
  MODE_CHANGED: 'mode:changed',
  
  // System Events
  SYSTEM_ERROR: 'system:error',
  SYSTEM_WARNING: 'system:warning',
  SYSTEM_INFO: 'system:info',
} as const;

// ============================================================================
// File Paths
// ============================================================================

export const PATHS = {
  CONFIG: './config',
  MEMORY: './memory',
  LOGS: './logs',
  DATA: './data',
  TEMP: './temp',
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

export const FEATURES = {
  ORB_MODE: true,
  SPHERE_MODE: true,
  WAVE_MODE: true,
  HUD_MODE: true,
  AMBIENT_MODE: true,
  VOICE: true,   // Implemented in-browser via Web Speech API (see VOICE_ARCHITECTURE.md)
  MOBILE: false, // Deferred to later phase
  BROWSER_AUTOMATION: false, // Deferred to later phase
  COMPUTER_CONTROL: false, // Deferred to later phase
} as const;
