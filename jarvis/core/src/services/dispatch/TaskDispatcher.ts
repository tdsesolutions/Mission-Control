/**
 * Task Dispatcher — the sanctioned Kiaros → Mission Control WRITE path.
 * Owner-approved 2026-07-09 (production directive; Constitution v1.3).
 *
 * Invariants:
 * - EVERY dispatch obtains an Approval Engine decision first. There is no
 *   code path to Mission Control task creation that skips the engine —
 *   bypassing it is a FORBIDDEN change class (Constitution Art. V).
 * - `approved` decisions dispatch immediately; `requires_owner_approval`
 *   decisions are held in a persisted queue until the owner explicitly
 *   approves or denies them; `requires_clarification` and `rejected` never
 *   dispatch.
 * - Mission Control stays the single system of record: Kiaros keeps only
 *   the pending-approval queue (its own decision state), never task state.
 * - Honesty (Art. IV): an MC failure is reported as a failure — a dispatch
 *   is only ever called "created" when MC returned the real task.
 */

import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { getApprovalEngine, ApprovalEngine } from '../approval/ApprovalEngine.js';
import { getMissionControlClient, MissionControlClient } from '../missionControlClient.js';
import { getMemoryService, MemoryService } from '../memoryService.js';
import { getEventBus } from '../eventBus.js';
import type { ApprovalDecision } from '../approval/types.js';
import type { PendingDispatch, Task, TaskPriority } from '../../../../shared/types/index.js';

const MEMORY_KEY = 'dispatch.pending';
const MAX_QUEUE_ENTRIES = 200;
const TITLE_MAX_LENGTH = 80;

export type DispatchOutcome =
  | { outcome: 'dispatched'; task: Task; decision: ApprovalDecision }
  | { outcome: 'pending_owner_approval'; pending: PendingDispatch; decision: ApprovalDecision }
  | { outcome: 'clarification_needed'; decision: ApprovalDecision }
  | { outcome: 'rejected'; decision: ApprovalDecision }
  | { outcome: 'dispatch_failed'; error: string; decision: ApprovalDecision };

export interface DispatchRequest {
  /** Natural-language statement of the requested work. */
  intent: string;
  /** Optional explicit title override (defaults to a cleaned intent prefix). */
  title?: string;
  /** Requester tag for the audit trail ('conversation', 'api'…). */
  source?: string;
}

/** B8 level → MC priority. Higher-scrutiny work lands higher in the queue. */
const LEVEL_PRIORITY: Record<number, TaskPriority> = {
  0: 'low',
  1: 'medium',
  2: 'medium',
  3: 'high',
  4: 'high',
};

export class TaskDispatcher {
  constructor(
    private readonly deps: {
      approvalEngine: ApprovalEngine;
      missionControl: MissionControlClient;
      memory: MemoryService;
    },
  ) {}

  /**
   * Classify a request through the Approval Engine and act on the decision.
   * The ONLY entry point to Kiaros-initiated task creation.
   */
  async requestDispatch(request: DispatchRequest): Promise<DispatchOutcome> {
    const source = request.source ?? 'api';
    const decision = this.deps.approvalEngine.classify({ intent: request.intent, source });

    switch (decision.state) {
      case 'approved':
        return this.createInMissionControl(request, decision);

      case 'requires_owner_approval': {
        const pending = this.enqueuePending(request, decision, source);
        logger.info(`Dispatch held for owner approval: ${pending.id} (${decision.id})`);
        return { outcome: 'pending_owner_approval', pending, decision };
      }

      case 'requires_clarification':
        return { outcome: 'clarification_needed', decision };

      case 'rejected':
        return { outcome: 'rejected', decision };
    }
  }

  /** Pending queue, newest last. Includes resolved entries for audit reads. */
  listPending(includeResolved = false): PendingDispatch[] {
    const queue = this.loadQueue();
    return includeResolved ? queue : queue.filter((entry) => entry.status === 'pending');
  }

  /**
   * Owner approval of a held dispatch → the task is created in Mission
   * Control now. MC failure keeps the entry pending (with lastError) so
   * approval is never silently lost.
   */
  async approvePending(id: string): Promise<
    | { ok: true; pending: PendingDispatch; task: Task }
    | { ok: false; error: string; status: number }
  > {
    const queue = this.loadQueue();
    const entry = queue.find((candidate) => candidate.id === id);
    if (!entry) return { ok: false, error: `No pending dispatch with id ${id}`, status: 404 };
    if (entry.status !== 'pending') {
      return { ok: false, error: `Dispatch ${id} was already ${entry.status}`, status: 409 };
    }

    const result = await this.deps.missionControl.createTask(this.buildTaskPayload(entry.intent, entry.decision));
    if (!result.ok || !result.data) {
      entry.lastError = result.error ?? 'Mission Control did not respond';
      this.saveQueue(queue);
      return { ok: false, error: entry.lastError, status: 502 };
    }

    entry.status = 'approved';
    entry.resolvedAt = new Date().toISOString();
    entry.taskId = result.data.id;
    delete entry.lastError;
    this.saveQueue(queue);

    getEventBus()?.emitEvent('approval_granted', 'info', 'task-dispatcher',
      `Owner approved dispatch ${id} → MC task ${result.data.id}: ${entry.intent.slice(0, 120)}`,
      { pendingId: id, taskId: result.data.id });
    getEventBus()?.emitEvent('task_created', 'info', 'task-dispatcher',
      `Task ${result.data.id} created in Mission Control (owner-approved dispatch)`,
      { taskId: result.data.id, pendingId: id });

    return { ok: true, pending: entry, task: result.data };
  }

  /** Owner denial of a held dispatch. Nothing is created anywhere. */
  denyPending(id: string, reason?: string): { ok: true; pending: PendingDispatch } | { ok: false; error: string; status: number } {
    const queue = this.loadQueue();
    const entry = queue.find((candidate) => candidate.id === id);
    if (!entry) return { ok: false, error: `No pending dispatch with id ${id}`, status: 404 };
    if (entry.status !== 'pending') {
      return { ok: false, error: `Dispatch ${id} was already ${entry.status}`, status: 409 };
    }

    entry.status = 'denied';
    entry.resolvedAt = new Date().toISOString();
    if (reason) entry.lastError = `Denied by owner: ${reason}`;
    this.saveQueue(queue);

    getEventBus()?.emitEvent('approval_denied', 'info', 'task-dispatcher',
      `Owner denied dispatch ${id}: ${entry.intent.slice(0, 120)}`,
      { pendingId: id, reason: reason ?? null });

    return { ok: true, pending: entry };
  }

  // -------------------------------------------------------------------------

  private async createInMissionControl(request: DispatchRequest, decision: ApprovalDecision): Promise<DispatchOutcome> {
    const result = await this.deps.missionControl.createTask(this.buildTaskPayload(request.intent, decision, request.title));
    if (!result.ok || !result.data) {
      const error = result.error ?? 'Mission Control did not respond';
      logger.warn(`Approved dispatch could not reach Mission Control: ${error}`);
      return { outcome: 'dispatch_failed', error, decision };
    }

    getEventBus()?.emitEvent('task_created', 'info', 'task-dispatcher',
      `Task ${result.data.id} created in Mission Control (auto-approved level ${decision.level})`,
      { taskId: result.data.id, decisionId: decision.id });

    return { outcome: 'dispatched', task: result.data, decision };
  }

  private buildTaskPayload(
    intent: string,
    decision: { id: string; state: string; level: number; reason: string },
    titleOverride?: string,
  ) {
    const cleaned = intent.replace(/\s+/g, ' ').trim();
    const title = (titleOverride?.trim() || cleaned).slice(0, TITLE_MAX_LENGTH);
    return {
      title,
      description:
        `${cleaned}\n\n---\nCreated by Kiaros (owner request).\n` +
        `Approval Engine decision ${decision.id}: ${decision.state} (level ${decision.level}) — ${decision.reason}`,
      priority: LEVEL_PRIORITY[decision.level] ?? 'medium',
      assignedTo: config.missionControl.assignee || undefined,
      tags: ['kiaros'],
      metadata: {
        source: 'kiaros',
        approval: { id: decision.id, state: decision.state, level: decision.level },
      },
    };
  }

  private enqueuePending(request: DispatchRequest, decision: ApprovalDecision, source: string): PendingDispatch {
    const queue = this.loadQueue();
    const pending: PendingDispatch = {
      id: `pnd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      intent: request.intent,
      decision: { id: decision.id, state: decision.state, level: decision.level, reason: decision.reason },
      status: 'pending',
      createdAt: new Date().toISOString(),
      source,
    };
    queue.push(pending);
    // Cap the queue by dropping the oldest RESOLVED entries first; pending
    // entries are never silently discarded.
    while (queue.length > MAX_QUEUE_ENTRIES) {
      const resolvedIndex = queue.findIndex((entry) => entry.status !== 'pending');
      if (resolvedIndex === -1) break;
      queue.splice(resolvedIndex, 1);
    }
    this.saveQueue(queue);
    return pending;
  }

  private loadQueue(): PendingDispatch[] {
    const stored = this.deps.memory.get<PendingDispatch[]>(MEMORY_KEY);
    return Array.isArray(stored) ? stored : [];
  }

  private saveQueue(queue: PendingDispatch[]): void {
    this.deps.memory.set(MEMORY_KEY, queue);
    void this.deps.memory.saveMemory();
  }
}

let sharedInstance: TaskDispatcher | null = null;

/** Shared dispatcher instance (route modules + ConversationManager). */
export function getTaskDispatcher(): TaskDispatcher {
  if (!sharedInstance) {
    sharedInstance = new TaskDispatcher({
      approvalEngine: getApprovalEngine(),
      missionControl: getMissionControlClient(),
      memory: getMemoryService(),
    });
  }
  return sharedInstance;
}
