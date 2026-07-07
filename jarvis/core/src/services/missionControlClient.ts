/**
 * Mission Control Client
 * The ONLY sanctioned Kiaros → Mission Control interface (COMPONENT_OWNERSHIP §2).
 *
 * READ-ONLY in effect: health + task/project/agent reads. Write methods are
 * intentionally ABSENT — Kiaros→MC writes are constitutionally gated on a
 * future owner-approved phase that routes through the Approval Engine
 * (PROJECT_CONSTITUTION Art. V). Mission Control remains the single system
 * of record; Kiaros reads through, never mirrors (STATE_MANAGEMENT §3).
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { Task, TaskStatus, TaskPriority, Project } from '../../../shared/types/index.js';

interface MissionControlConfig {
  url: string;
  apiKey: string;
}

export interface McReadResult<T> {
  ok: boolean;
  data?: T;
  /** Honest failure description for degraded responses (Art. IV). */
  error?: string;
  status?: number;
}

const REQUEST_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Shape mapping: MC rows → Kiaros shared types. Pure functions, unit-tested.
// The original MC values are preserved in metadata.classification.
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, TaskStatus> = {
  inbox: 'pending',
  queued: 'pending',
  assigned: 'pending',
  pending_approval: 'pending',
  in_progress: 'in_progress',
  dispatched: 'in_progress',
  review: 'in_progress',
  blocked: 'blocked',
  done: 'completed',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled',
  failed: 'cancelled',
};

const PRIORITY_MAP: Record<string, TaskPriority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'critical',
  critical: 'critical',
};

export interface McTaskRow {
  id: number | string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  project_id?: number | null;
  project_name?: string | null;
  assigned_to?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
}

export interface McProjectRow {
  id: number | string;
  name?: string;
  description?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export function mapMcTask(row: McTaskRow): Task {
  const rawStatus = String(row.status ?? 'pending');
  const rawPriority = String(row.priority ?? 'medium');
  return {
    id: String(row.id),
    title: row.title ?? '(untitled)',
    description: row.description ?? '',
    status: STATUS_MAP[rawStatus] ?? 'pending',
    priority: PRIORITY_MAP[rawPriority] ?? 'medium',
    projectId: row.project_id != null ? String(row.project_id) : undefined,
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? row.created_at ?? Date.now()),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    assignedTo: row.assigned_to ?? undefined,
    metadata: {
      source: 'mission_control',
      classification: `mc:${rawStatus}/${rawPriority}`,
      tags: [],
    },
  };
}

const PROJECT_STATUS = new Set(['active', 'paused', 'completed', 'archived']);

export function mapMcProject(row: McProjectRow): Project {
  const rawStatus = String(row.status ?? 'active');
  return {
    id: String(row.id),
    name: row.name ?? '(unnamed)',
    description: row.description ?? '',
    status: (PROJECT_STATUS.has(rawStatus) ? rawStatus : 'active') as Project['status'],
    path: '',
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? row.created_at ?? Date.now()),
    tasks: [],
    metrics: { totalTasks: 0, completedTasks: 0, blockedTasks: 0, progressPercentage: 0 },
  };
}

// ---------------------------------------------------------------------------

export class MissionControlClient {
  private config: MissionControlConfig;
  private connected = false;
  private initialized = false;

  constructor() {
    this.config = {
      url: config.missionControl.url,
      apiKey: config.missionControl.apiKey,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Mission Control Client...');
    logger.info(`Mission Control URL: ${this.config.url}`);
    logger.info(`API key configured: ${this.config.apiKey ? 'yes' : 'NO — reads will be unauthenticated and fail'}`);

    await this.checkHealth();

    this.initialized = true;
    logger.info('Mission Control Client initialized');
  }

  async shutdown(): Promise<void> {
    this.connected = false;
  }

  async checkHealth(): Promise<boolean> {
    const result = await this.rawGet<{ status?: string }>('/api/health', 5000);
    this.connected = result.ok && (result.data?.status === 'healthy' || result.data?.status === 'ok');
    if (!this.connected) {
      logger.warn(`Mission Control is not reachable: ${result.error ?? result.data?.status}`);
    }
    return this.connected;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Timeboxed authenticated GET. Never throws; failures are data (Art. IV honesty). */
  private async rawGet<T>(endpoint: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<McReadResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.config.apiKey) headers['x-api-key'] = this.config.apiKey;

      const response = await fetch(`${this.config.url}${endpoint}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return {
          ok: false,
          status: response.status,
          error: `Mission Control returned HTTP ${response.status}${body ? `: ${body.slice(0, 120)}` : ''}`,
        };
      }

      return { ok: true, status: response.status, data: (await response.json()) as T };
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? `Mission Control did not respond within ${timeoutMs}ms`
        : `Mission Control unreachable: ${error instanceof Error ? error.message : String(error)}`;
      return { ok: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---- Sanctioned reads (MISSION_CONTROL_ARCHITECTURE §5) ----

  async listTasks(params?: { status?: string; limit?: number }): Promise<McReadResult<{ tasks: Task[]; total: number }>> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    search.set('limit', String(params?.limit ?? 50));

    const result = await this.rawGet<{ tasks: McTaskRow[]; total: number }>(`/api/tasks?${search.toString()}`);
    if (!result.ok || !result.data) return { ok: false, error: result.error, status: result.status };

    return {
      ok: true,
      data: {
        tasks: (result.data.tasks ?? []).map(mapMcTask),
        total: result.data.total ?? result.data.tasks?.length ?? 0,
      },
    };
  }

  async getTask(id: string): Promise<McReadResult<Task>> {
    const result = await this.rawGet<{ task?: McTaskRow } | McTaskRow>(`/api/tasks/${encodeURIComponent(id)}`);
    if (!result.ok || !result.data) return { ok: false, error: result.error, status: result.status };
    const row = (result.data as { task?: McTaskRow }).task ?? (result.data as McTaskRow);
    if (!row || row.id === undefined) return { ok: false, status: 404, error: 'Task not found in Mission Control' };
    return { ok: true, data: mapMcTask(row) };
  }

  async listProjects(): Promise<McReadResult<Project[]>> {
    const result = await this.rawGet<{ projects: McProjectRow[] }>('/api/projects');
    if (!result.ok || !result.data) return { ok: false, error: result.error, status: result.status };
    return { ok: true, data: (result.data.projects ?? []).map(mapMcProject) };
  }

  async listAgents(): Promise<McReadResult<unknown[]>> {
    const result = await this.rawGet<{ agents?: unknown[] } | unknown[]>('/api/agents');
    if (!result.ok || !result.data) return { ok: false, error: result.error, status: result.status };
    const agents = Array.isArray(result.data) ? result.data : result.data.agents ?? [];
    return { ok: true, data: agents };
  }
}

let sharedInstance: MissionControlClient | null = null;

/** Shared client instance (route modules + service container). */
export function getMissionControlClient(): MissionControlClient {
  if (!sharedInstance) {
    sharedInstance = new MissionControlClient();
  }
  return sharedInstance;
}
