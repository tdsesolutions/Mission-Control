import { describe, it, expect } from 'vitest';
import {
  parseApproveCommand,
  runApproveCommand,
  type ApproveCommandDeps,
} from './approveCommand.js';
import type { Task } from '../../../../shared/types/index.js';

const task = (id: string): Task => ({
  id,
  title: `Task ${id}`,
  description: '',
  status: 'needs_review',
  priority: 'medium',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  metadata: { source: 'mission_control', tags: [] },
});

describe('parseApproveCommand', () => {
  it('detects imperative approvals with and without a task id', () => {
    expect(parseApproveCommand('approve it now')).toEqual({ isApprove: true, taskId: undefined });
    expect(parseApproveCommand('Approve task 4')).toEqual({ isApprove: true, taskId: '4' });
    expect(parseApproveCommand('accept task #12 please')).toEqual({ isApprove: true, taskId: '12' });
    expect(parseApproveCommand('sign off on task number 7')).toEqual({ isApprove: true, taskId: '7' });
    expect(parseApproveCommand('please approve that')).toEqual({ isApprove: true, taskId: undefined });
    expect(parseApproveCommand('Kiaros, approve task 3')).toEqual({ isApprove: true, taskId: '3' });
    expect(parseApproveCommand('ok approve it')).toEqual({ isApprove: true, taskId: undefined });
  });

  it('ignores mid-sentence mentions and questions — conversation, not commands', () => {
    expect(parseApproveCommand('did you approve the task?').isApprove).toBe(false);
    expect(parseApproveCommand('i told kiaros to approve the task').isApprove).toBe(false);
    expect(parseApproveCommand('what needs my approval?').isApprove).toBe(false);
    expect(parseApproveCommand('tell claw to approve of the design').isApprove).toBe(false);
    expect(parseApproveCommand('create a file called approve.txt').isApprove).toBe(false);
  });
});

const makeDeps = (overrides: Partial<ApproveCommandDeps> = {}): ApproveCommandDeps & {
  calls: string[];
} => {
  const calls: string[] = [];
  return {
    calls,
    acceptReviewTask: async (id) => {
      calls.push(`accept:${id}`);
      return { ok: true, data: task(id) };
    },
    listReviewTasks: async () => [],
    listPendingDispatches: () => [],
    approvePendingDispatch: async (id) => {
      calls.push(`release:${id}`);
      return { ok: true, taskId: '99' };
    },
    ...overrides,
  };
};

describe('runApproveCommand', () => {
  it('NEVER mutates without a verified execute code, and the reply does not reveal why', async () => {
    const deps = makeDeps();
    const result = await runApproveCommand(deps, { isApprove: true, taskId: '4' }, false);
    expect(result.outcome).toBe('needs_code');
    expect(deps.calls).toEqual([]);
    expect(result.message).not.toMatch(/wrong|invalid|incorrect/i);
  });

  it('accepts an explicitly named review task', async () => {
    const deps = makeDeps();
    const result = await runApproveCommand(deps, { isApprove: true, taskId: '4' }, true);
    expect(result.outcome).toBe('accepted_review');
    expect(result.taskId).toBe('4');
    expect(deps.calls).toEqual(['accept:4']);
  });

  it('reports honestly when the named task is not in review', async () => {
    const deps = makeDeps({
      acceptReviewTask: async () => ({ ok: false, error: 'Task 2 is not awaiting review (mc:in_progress/medium)' }),
    });
    const result = await runApproveCommand(deps, { isApprove: true, taskId: '2' }, true);
    expect(result.outcome).toBe('failed');
    expect(result.message).toContain('not awaiting review');
  });

  it('with no id, held dispatches (not-yet-run work) win over review acceptance', async () => {
    const deps = makeDeps({
      listPendingDispatches: () => [
        { id: 'pd_1', intent: 'older' },
        { id: 'pd_2', intent: 'newer' },
      ],
      listReviewTasks: async () => [task('4')],
    });
    const result = await runApproveCommand(deps, { isApprove: true }, true);
    expect(result.outcome).toBe('released_dispatch');
    expect(deps.calls).toEqual(['release:pd_2']);
  });

  it('with no id and no held dispatches, accepts the newest review task', async () => {
    const deps = makeDeps({ listReviewTasks: async () => [task('4'), task('5')] });
    const result = await runApproveCommand(deps, { isApprove: true }, true);
    expect(result.outcome).toBe('accepted_review');
    expect(result.taskId).toBe('5');
    expect(deps.calls).toEqual(['accept:5']);
  });

  it('says so plainly when nothing is waiting', async () => {
    const deps = makeDeps();
    const result = await runApproveCommand(deps, { isApprove: true }, true);
    expect(result.outcome).toBe('nothing_waiting');
    expect(deps.calls).toEqual([]);
  });
});
