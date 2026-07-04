/**
 * Tasks Route
 * Handle task management through Mission Control
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import type { Task, TaskStatus, TaskPriority } from '../../../../shared/types/index.js';

const router = Router();

// In-memory task store (will integrate with Mission Control)
const tasks: Map<string, Task> = new Map();

router.get('/', (req, res) => {
  const status = req.query.status as TaskStatus | undefined;
  const projectId = req.query.projectId as string | undefined;
  
  let taskList = Array.from(tasks.values());
  
  if (status) {
    taskList = taskList.filter(t => t.status === status);
  }
  
  if (projectId) {
    taskList = taskList.filter(t => t.projectId === projectId);
  }
  
  // Sort by updatedAt descending
  taskList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  res.json({
    success: true,
    data: taskList,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.get('/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  
  if (!task) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: `Task ${req.params.id} not found`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  res.json({
    success: true,
    data: task,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/', (req, res) => {
  const { title, description, priority = 'medium', projectId } = req.body;
  
  if (!title) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_TITLE',
        message: 'Task title is required',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  const now = new Date();
  const task: Task = {
    id: `task_${Date.now()}`,
    title,
    description: description || '',
    status: 'pending',
    priority: priority as TaskPriority,
    projectId,
    createdAt: now,
    updatedAt: now,
    metadata: {
      source: 'jarvis',
      tags: [],
    },
  };
  
  tasks.set(task.id, task);
  logger.info(`Task created: ${task.id} - ${title}`);
  
  res.status(201).json({
    success: true,
    data: task,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.patch('/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  
  if (!task) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: `Task ${req.params.id} not found`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  const { title, description, status, priority } = req.body;
  
  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  
  task.updatedAt = new Date();
  
  if (status === 'completed') {
    task.completedAt = new Date();
  }
  
  tasks.set(task.id, task);
  logger.info(`Task updated: ${task.id}`);
  
  res.json({
    success: true,
    data: task,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.delete('/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  
  if (!task) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: `Task ${req.params.id} not found`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  tasks.delete(req.params.id);
  logger.info(`Task deleted: ${req.params.id}`);
  
  res.json({
    success: true,
    data: { deleted: true },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as tasksRouter };
