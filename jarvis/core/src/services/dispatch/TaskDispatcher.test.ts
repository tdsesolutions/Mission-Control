/**
 * TaskDispatcher tests — the sanctioned Kiaros → Mission Control write path.
 *
 * Verifies the constitutional invariants: every dispatch is decided by the
 * Approval Engine first; only `approved` auto-creates; owner-approval holds
 * survive in the queue; rejections/clarifications never touch MC; MC
 * failures are reported honestly and never fabricate a task.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TaskDispatcher } from './TaskDispatcher.js';
import { ApprovalEngine } from '../approval/ApprovalEngine.js';
import type { MissionControlClient, McReadResult } from '../missionControlClient.js';
import type { MemoryService } from '../memoryService.js';
import type { Task } from '../../../../shared/types/index.js';

function fakeMemory(): MemoryService {
  const store = new Map<string, unknown>();
  return {
    get: <T>(key: string) => store.get(key) as T | undefined,
    set: <T>(key: string, value: T) => void store.set(key, value),
    saveMemory: async () => {},
  } as unknown as MemoryService;
}

function fakeMissionControl(behavior: {
  createTask?: (input: unknown) => Promise<McReadResult<Task>>;
}): { client: MissionControlClient; calls: unknown[] } {
  const calls: unknown[] = [];
  const client = {
    createTask: async (input: unknown) => {
      calls.push(input);
      if (behavior.createTask) return behavior.createTask(input);
      return {
        ok: true,
        status: 201,
        data: {
          id: '42',
          title: 'stub',
          description: '',
          status: 'pending',
          priority: 'medium',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { source: 'mission_control', tags: [] },
        } as Task,
      };
    },
  } as unknown as MissionControlClient;
  return { client, calls };
}

function makeDispatcher(mc: MissionControlClient, memory = fakeMemory()) {
  const auditDir = mkdtempSync(join(tmpdir(), 'kiaros-dispatch-test-'));
  const engine = new ApprovalEngine({ auditFile: join(auditDir, 'audit.jsonl') });
  return new TaskDispatcher({ approvalEngine: engine, missionControl: mc, memory });
}

describe('TaskDispatcher', () => {
  let mc: ReturnType<typeof fakeMissionControl>;
  let memory: MemoryService;
  let dispatcher: TaskDispatcher;

  beforeEach(() => {
    mc = fakeMissionControl({});
    memory = fakeMemory();
    dispatcher = makeDispatcher(mc.client, memory);
  });

  it('auto-dispatches an approved (level 0-1) request as a real MC task', async () => {
    const result = await dispatcher.requestDispatch({
      intent: 'Create a prototype landing page for the product demo',
      source: 'test',
    });
    expect(result.outcome).toBe('dispatched');
    if (result.outcome !== 'dispatched') return;
    expect(result.task.id).toBe('42');
    expect(mc.calls).toHaveLength(1);
    const payload = mc.calls[0] as { title: string; description: string; metadata: { approval: { state: string } } };
    expect(payload.title).toContain('Create a prototype landing page');
    expect(payload.description).toContain('Approval Engine decision');
    expect(payload.metadata.approval.state).toBe('approved');
  });

  it('holds a level-2 request for owner approval without touching MC', async () => {
    const result = await dispatcher.requestDispatch({
      intent: 'Fix the login bug in the dashboard project',
      source: 'test',
    });
    expect(result.outcome).toBe('pending_owner_approval');
    expect(mc.calls).toHaveLength(0);
    expect(dispatcher.listPending()).toHaveLength(1);
    expect(dispatcher.listPending()[0].status).toBe('pending');
  });

  it('owner approval of a held dispatch creates the MC task and resolves the entry', async () => {
    const held = await dispatcher.requestDispatch({ intent: 'Update the deployment configuration docs', source: 'test' });
    expect(held.outcome).toBe('pending_owner_approval');
    if (held.outcome !== 'pending_owner_approval') return;

    const approved = await dispatcher.approvePending(held.pending.id);
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.task.id).toBe('42');
    expect(approved.pending.status).toBe('approved');
    expect(approved.pending.taskId).toBe('42');
    expect(mc.calls).toHaveLength(1);
    expect(dispatcher.listPending()).toHaveLength(0);
    expect(dispatcher.listPending(true)).toHaveLength(1);
  });

  it('owner denial resolves the entry and never calls MC', async () => {
    const held = await dispatcher.requestDispatch({ intent: 'Refactor the payment service module', source: 'test' });
    if (held.outcome !== 'pending_owner_approval') throw new Error('expected hold');

    const denied = dispatcher.denyPending(held.pending.id, 'not now');
    expect(denied.ok).toBe(true);
    expect(mc.calls).toHaveLength(0);
    expect(dispatcher.listPending()).toHaveLength(0);
  });

  it('a resolved entry cannot be approved or denied twice', async () => {
    const held = await dispatcher.requestDispatch({ intent: 'Refactor the payment service module', source: 'test' });
    if (held.outcome !== 'pending_owner_approval') throw new Error('expected hold');
    dispatcher.denyPending(held.pending.id);

    const again = await dispatcher.approvePending(held.pending.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe(409);
  });

  it('rejects dangerous requests without touching MC', async () => {
    const result = await dispatcher.requestDispatch({ intent: 'Please delete all repositories right now', source: 'test' });
    expect(result.outcome).toBe('rejected');
    expect(mc.calls).toHaveLength(0);
  });

  it('asks for clarification on unclassifiable requests without touching MC', async () => {
    const result = await dispatcher.requestDispatch({ intent: 'hm', source: 'test' });
    expect(result.outcome).toBe('clarification_needed');
    expect(mc.calls).toHaveLength(0);
  });

  it('reports an honest dispatch_failed when MC is unreachable (no fake task)', async () => {
    const failing = fakeMissionControl({
      createTask: async () => ({ ok: false, error: 'Mission Control unreachable: connect ECONNREFUSED' }),
    });
    const failingDispatcher = makeDispatcher(failing.client);
    const result = await failingDispatcher.requestDispatch({ intent: 'Create a test scaffold for the API client', source: 'test' });
    expect(result.outcome).toBe('dispatch_failed');
    if (result.outcome !== 'dispatch_failed') return;
    expect(result.error).toContain('unreachable');
  });

  it('keeps an owner-approved entry pending (with lastError) when MC fails post-approval', async () => {
    const failing = fakeMissionControl({
      createTask: async () => ({ ok: false, error: 'Mission Control did not respond within 10000ms' }),
    });
    const mem = fakeMemory();
    const failingDispatcher = makeDispatcher(failing.client, mem);
    const held = await failingDispatcher.requestDispatch({ intent: 'Update the onboarding flow copy', source: 'test' });
    if (held.outcome !== 'pending_owner_approval') throw new Error('expected hold');

    const attempt = await failingDispatcher.approvePending(held.pending.id);
    expect(attempt.ok).toBe(false);
    // Approval must not be lost: the entry stays pending and records why.
    const pending = failingDispatcher.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].lastError).toContain('did not respond');
  });

  it('persists the pending queue through the memory service (restart survival)', async () => {
    const held = await dispatcher.requestDispatch({ intent: 'Update the analytics pipeline schema', source: 'test' });
    if (held.outcome !== 'pending_owner_approval') throw new Error('expected hold');

    // A second dispatcher over the SAME memory store sees the held entry.
    const revived = makeDispatcher(mc.client, memory);
    expect(revived.listPending()).toHaveLength(1);
    expect(revived.listPending()[0].id).toBe(held.pending.id);
  });

  // --- Owner execute code (owner-approved 2026-07-23) ---

  it('execAuthorized pre-approves a level-2 request straight into MC with auto_accept', async () => {
    const result = await dispatcher.requestDispatch({
      intent: 'Fix the login bug in the dashboard project',
      source: 'test',
      execAuthorized: true,
    });
    expect(result.outcome).toBe('dispatched');
    expect(dispatcher.listPending()).toHaveLength(0); // nothing held
    expect(mc.calls).toHaveLength(1);
    const payload = mc.calls[0] as { description: string; metadata: Record<string, unknown> };
    expect(payload.metadata.auto_accept).toBe(true);
    expect(payload.description).toContain('pre-authorized via execute code');
  });

  it('execAuthorized marks even auto-approved (level 1) tasks auto_accept', async () => {
    const result = await dispatcher.requestDispatch({
      intent: 'Create a prototype landing page for the product demo',
      source: 'test',
      execAuthorized: true,
    });
    expect(result.outcome).toBe('dispatched');
    const payload = mc.calls[0] as { metadata: Record<string, unknown> };
    expect(payload.metadata.auto_accept).toBe(true);
  });

  it('without execAuthorized, tasks carry NO auto_accept flag', async () => {
    await dispatcher.requestDispatch({
      intent: 'Create a prototype landing page for the product demo',
      source: 'test',
    });
    const payload = mc.calls[0] as { metadata: Record<string, unknown> };
    expect(payload.metadata.auto_accept).toBeUndefined();
  });

  it('execAuthorized NEVER bypasses level 3+ (deploy stays held)', async () => {
    const result = await dispatcher.requestDispatch({
      intent: 'Deploy the site to production',
      source: 'test',
      execAuthorized: true,
    });
    expect(result.outcome).toBe('pending_owner_approval');
    expect(mc.calls).toHaveLength(0);
    expect(dispatcher.listPending()).toHaveLength(1);
  });

  it('execAuthorized never rescues rejected or unclassifiable requests', async () => {
    const rejected = await dispatcher.requestDispatch({
      intent: 'delete all repositories now',
      source: 'test',
      execAuthorized: true,
    });
    expect(rejected.outcome).toBe('rejected');
    const unclear = await dispatcher.requestDispatch({
      intent: 'zorble the flumph quietly',
      source: 'test',
      execAuthorized: true,
    });
    expect(unclear.outcome).toBe('clarification_needed');
    expect(mc.calls).toHaveLength(0);
  });
});
