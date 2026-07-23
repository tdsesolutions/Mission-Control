/**
 * Mission Control Client
 * The ONLY sanctioned Kiaros → Mission Control interface (COMPONENT_OWNERSHIP §2).
 *
 * Reads: health + task/project/agent reads + knowledge search.
 * Writes: task creation ONLY (owner-approved 2026-07-09), and the sole
 * caller is the TaskDispatcher, which obtains an Approval Engine decision
 * first — calling createTask from anywhere else bypasses the engine and is
 * a FORBIDDEN change class (PROJECT_CONSTITUTION Art. V). Mission Control
 * remains the single system of record; Kiaros reads through, never mirrors
 * (STATE_MANAGEMENT §3).
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
  // A finished task awaiting the owner's acceptance must not masquerade as
  // still-running work — that hid completed Claw results from the Task tab
  // (owner-reported 2026-07-23).
  review: 'needs_review',
  quality_review: 'needs_review',
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
  created_at?: string | number;
  updated_at?: string | number;
  completed_at?: string | number | null;
}

export interface McProjectRow {
  id: number | string;
  name?: string;
  description?: string | null;
  status?: string;
  created_at?: string | number;
  updated_at?: string | number;
}

/**
 * MC timestamps arrive as ISO strings from some endpoints and unix SECONDS
 * from others (SQLite integers). `new Date(seconds)` would land in 1970 —
 * treat numbers below ~2001-09 in ms terms as seconds.
 */
export function toMcDate(value: string | number | null | undefined): Date {
  if (value == null) return new Date();
  if (typeof value === 'number') {
    return new Date(value < 1_000_000_000_000 ? value * 1000 : value);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
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
    createdAt: toMcDate(row.created_at),
    updatedAt: toMcDate(row.updated_at ?? row.created_at),
    completedAt: row.completed_at ? toMcDate(row.completed_at) : undefined,
    assignedTo: row.assigned_to ?? undefined,
    metadata: {
      source: 'mission_control',
      classification: `mc:${rawStatus}/${rawPriority}`,
      tags: [],
    },
  };
}

export interface McKnowledgeHit {
  path: string;
  title: string;
  snippet: string;
}

/** Map MC memory-search results; strips FTS highlight markup. */
export function mapKnowledgeHits(data: {
  results?: Array<{ path?: string; title?: string; snippet?: string }>;
}): McKnowledgeHit[] {
  return (data.results ?? []).slice(0, 10).map((row) => ({
    path: String(row.path ?? ''),
    title: String(row.title ?? ''),
    snippet: String(row.snippet ?? '').replace(/<\/?mark>/g, ''),
  }));
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
    createdAt: toMcDate(row.created_at),
    updatedAt: toMcDate(row.updated_at ?? row.created_at),
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

  /** Timeboxed authenticated POST. Never throws; failures are data (Art. IV honesty). */
  private async rawPost<T>(endpoint: string, body: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<McReadResult<T>> {
    return this.rawWrite<T>('POST', endpoint, body, timeoutMs);
  }

  private async rawPut<T>(endpoint: string, body: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<McReadResult<T>> {
    return this.rawWrite<T>('PUT', endpoint, body, timeoutMs);
  }

  private async rawWrite<T>(method: 'POST' | 'PUT', endpoint: string, body: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<McReadResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (this.config.apiKey) headers['x-api-key'] = this.config.apiKey;

      const response = await fetch(`${this.config.url}${endpoint}`, {
        method,
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '');
        return {
          ok: false,
          status: response.status,
          error: `Mission Control returned HTTP ${response.status}${responseBody ? `: ${responseBody.slice(0, 120)}` : ''}`,
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

  /**
   * Knowledge Vault search (READ-ONLY) — MC's FTS5 memory search, which the
   * owner has pointed at the Obsidian vault (OPENCLAW_MEMORY_DIR). Short
   * timeout: this rides the conversation path and must never stall a reply.
   */
  async searchKnowledge(query: string, limit = 3): Promise<McReadResult<McKnowledgeHit[]>> {
    const search = new URLSearchParams({ q: query, limit: String(limit) });
    const result = await this.rawGet<{ results?: Array<{ path?: string; title?: string; snippet?: string }> }>(
      `/api/memory/search?${search.toString()}`,
      2500
    );
    if (!result.ok || !result.data) return { ok: false, error: result.error, status: result.status };
    return { ok: true, data: mapKnowledgeHits(result.data) };
  }

  // ---- Sanctioned write: task creation (owner-approved 2026-07-09) ----

  /**
   * Create a task in Mission Control. RESTRICTED CALLER: TaskDispatcher
   * only, which routes every request through the Approval Engine first
   * (Constitution Art. V — bypassing the engine is FORBIDDEN).
   */
  async createTask(input: {
    title: string;
    description: string;
    priority?: TaskPriority;
    assignedTo?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<McReadResult<Task>> {
    const payload: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      priority: input.priority ?? 'medium',
      created_by: 'kiaros',
      tags: input.tags ?? ['kiaros'],
      metadata: input.metadata ?? {},
    };
    if (input.assignedTo) payload.assigned_to = input.assignedTo;

    const result = await this.rawPost<{ task?: McTaskRow } | McTaskRow>('/api/tasks', payload);
    if (!result.ok || !result.data) return { ok: false, error: result.error, status: result.status };

    const row = (result.data as { task?: McTaskRow }).task ?? (result.data as McTaskRow);
    if (!row || row.id === undefined) {
      return { ok: false, status: result.status, error: 'Mission Control accepted the request but returned no task' };
    }
    return { ok: true, status: result.status, data: mapMcTask(row) };
  }

  /**
   * Accept a task sitting in Mission Control's review column → done.
   * RESTRICTED CALLER: owner-approval paths only (the conversational
   * approve command and POST /tasks/:id/approve), both of which verify the
   * owner's execute code first. Refuses any task that is not actually
   * awaiting review — this method accepts finished work, it never
   * force-completes running or queued tasks.
   */
  async acceptReviewTask(id: string, note: string): Promise<McReadResult<Task>> {
    const current = await this.getTask(id);
    if (!current.ok || !current.data) return { ok: false, error: current.error, status: current.status };

    const classification = current.data.metadata.classification ?? '';
    if (!/^mc:(review|quality_review)\//.test(classification)) {
      return {
        ok: false,
        status: 409,
        error: `Task ${id} is not awaiting review (${classification || 'unknown state'})`,
      };
    }

    // owner_override: this method is only reachable after the owner's
    // execute code was verified, which supersedes MC's Aegis quality gate
    // (owner directive 2026-07-23). MC records the override as a system
    // comment on the task.
    const updated = await this.rawPut<{ task?: McTaskRow } | McTaskRow>(`/api/tasks/${encodeURIComponent(id)}`, { status: 'done', owner_override: true });
    if (!updated.ok) return { ok: false, error: updated.error, status: updated.status };

    // Audit trail on the task itself. Comment failure never rolls back the
    // acceptance — report success with the state that actually holds.
    await this.rawPost(`/api/tasks/${encodeURIComponent(id)}/comments`, { content: note });

    const after = await this.getTask(id);
    if (after.ok && after.data) return after;
    return { ok: true, status: 200, data: current.data };
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
