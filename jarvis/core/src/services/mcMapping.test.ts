import { describe, it, expect } from 'vitest';
import { mapMcTask, mapMcProject } from './missionControlClient.js';

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
    expect(mapMcTask({ id: 1, status: 'review' }).status).toBe('in_progress');
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
});
