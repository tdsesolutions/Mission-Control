import { describe, it, expect } from 'vitest';
import { mapMcTask, mapMcProject, toMcDate } from './missionControlClient.js';

describe('Mission Control → Kiaros shape mapping (read-through proxy)', () => {
  it('maps a typical MC task row', () => {
    const task = mapMcTask({
      id: 42,
      title: 'Fix the footer',
      description: 'CSS bug',
      status: 'in_progress',
      priority: 'high',
      project_id: 7,
      assigned_to: 'main',
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-02T10:00:00Z',
    });
    expect(task.id).toBe('42');
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.projectId).toBe('7');
    expect(task.assignedTo).toBe('main');
    expect(task.metadata.source).toBe('mission_control');
  });

  it('maps MC statuses into the Kiaros status vocabulary', () => {
    expect(mapMcTask({ id: 1, status: 'inbox' }).status).toBe('pending');
    expect(mapMcTask({ id: 1, status: 'queued' }).status).toBe('pending');
    expect(mapMcTask({ id: 1, status: 'dispatched' }).status).toBe('in_progress');
    expect(mapMcTask({ id: 1, status: 'review' }).status).toBe('needs_review');
    expect(mapMcTask({ id: 1, status: 'quality_review' }).status).toBe('needs_review');
    expect(mapMcTask({ id: 1, status: 'done' }).status).toBe('completed');
    expect(mapMcTask({ id: 1, status: 'failed' }).status).toBe('cancelled');
    expect(mapMcTask({ id: 1, status: 'weird-future-status' }).status).toBe('pending');
  });

  it('preserves the original MC status/priority in metadata', () => {
    const task = mapMcTask({ id: 1, status: 'failed', priority: 'urgent' });
    expect(task.metadata.classification).toBe('mc:failed/urgent');
    expect(task.priority).toBe('critical');
  });

  it('handles sparse rows without throwing', () => {
    const task = mapMcTask({ id: 9 });
    expect(task.title).toBe('(untitled)');
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('medium');
  });

  it('maps projects with unknown statuses safely', () => {
    const project = mapMcProject({ id: 3, name: 'Site', status: 'strange' });
    expect(project.id).toBe('3');
    expect(project.status).toBe('active');
    expect(project.metrics.totalTasks).toBe(0);
  });

  it('maps MC timestamps whether ISO strings, unix seconds, or unix ms', () => {
    // Regression: POST /api/tasks returns created_at as unix SECONDS —
    // fed raw to new Date() that landed in January 1970.
    const iso = '2026-07-09T12:00:00.000Z';
    expect(toMcDate(iso).toISOString()).toBe(iso);
    expect(toMcDate(1783638768).getUTCFullYear()).toBe(2026);
    expect(toMcDate(1783638768000).getUTCFullYear()).toBe(2026);
    expect(toMcDate(undefined).getUTCFullYear()).toBeGreaterThanOrEqual(2026);
    expect(toMcDate('not-a-date').getUTCFullYear()).toBeGreaterThanOrEqual(2026);

    const task = mapMcTask({ id: 1, created_at: 1783638768 });
    expect(task.createdAt.getUTCFullYear()).toBe(2026);
  });
});

describe('Knowledge Vault search mapping (Phase 4)', () => {
  it('maps results and strips FTS highlight markup', async () => {
    const { mapKnowledgeHits } = await import('./missionControlClient.js');
    const hits = mapKnowledgeHits({
      results: [
        { path: 'Projects/Kiaros.md', title: 'Kiaros', snippet: 'the <mark>voice</mark> loop is <mark>complete</mark>' },
        { path: 'Welcome.md', title: '', snippet: 'plain text' },
      ],
    });
    expect(hits).toEqual([
      { path: 'Projects/Kiaros.md', title: 'Kiaros', snippet: 'the voice loop is complete' },
      { path: 'Welcome.md', title: '', snippet: 'plain text' },
    ]);
  });

  it('tolerates missing or malformed fields', async () => {
    const { mapKnowledgeHits } = await import('./missionControlClient.js');
    expect(mapKnowledgeHits({})).toEqual([]);
    expect(mapKnowledgeHits({ results: [{}] })).toEqual([{ path: '', title: '', snippet: '' }]);
  });

  it('caps result count', async () => {
    const { mapKnowledgeHits } = await import('./missionControlClient.js');
    const many = { results: Array.from({ length: 25 }, (_, i) => ({ path: `n${i}.md`, snippet: 's' })) };
    expect(mapKnowledgeHits(many)).toHaveLength(10);
  });
});
