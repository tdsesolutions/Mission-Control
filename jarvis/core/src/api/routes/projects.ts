/**
 * Projects Route
 * Handle project management through Mission Control
 */

import { Router } from 'express';
import { logger } from '../../utils/logger.js';
import type { Project, ProjectStatus, ProjectMetrics } from '../../../../shared/types/index.js';

const router = Router();

// In-memory project store (will integrate with Mission Control)
const projects: Map<string, Project> = new Map();

// Initialize with a default project
const defaultProject: Project = {
  id: 'proj_default',
  name: 'Default Project',
  description: 'Default project for testing',
  status: 'active',
  path: '~/Projects/default',
  createdAt: new Date(),
  updatedAt: new Date(),
  tasks: [],
  metrics: {
    totalTasks: 0,
    completedTasks: 0,
    blockedTasks: 0,
    progressPercentage: 0,
  },
};
projects.set(defaultProject.id, defaultProject);

router.get('/', (req, res) => {
  const status = req.query.status as ProjectStatus | undefined;
  
  let projectList = Array.from(projects.values());
  
  if (status) {
    projectList = projectList.filter(p => p.status === status);
  }
  
  // Sort by updatedAt descending
  projectList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  
  res.json({
    success: true,
    data: projectList,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.get('/:id', (req, res) => {
  const project = projects.get(req.params.id);
  
  if (!project) {
    res.status(404).json({
      success: false,
      error: {
        code: 'PROJECT_NOT_FOUND',
        message: `Project ${req.params.id} not found`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  res.json({
    success: true,
    data: project,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.post('/', (req, res) => {
  const { name, description, path } = req.body;
  
  if (!name) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_NAME',
        message: 'Project name is required',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  const now = new Date();
  const metrics: ProjectMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    blockedTasks: 0,
    progressPercentage: 0,
  };
  
  const project: Project = {
    id: `proj_${Date.now()}`,
    name,
    description: description || '',
    status: 'active',
    path: path || `~/Projects/${name.toLowerCase().replace(/\s+/g, '-')}`,
    createdAt: now,
    updatedAt: now,
    tasks: [],
    metrics,
  };
  
  projects.set(project.id, project);
  logger.info(`Project created: ${project.id} - ${name}`);
  
  res.status(201).json({
    success: true,
    data: project,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.patch('/:id', (req, res) => {
  const project = projects.get(req.params.id);
  
  if (!project) {
    res.status(404).json({
      success: false,
      error: {
        code: 'PROJECT_NOT_FOUND',
        message: `Project ${req.params.id} not found`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  const { name, description, status, path } = req.body;
  
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (status !== undefined) project.status = status;
  if (path !== undefined) project.path = path;
  
  project.updatedAt = new Date();
  
  projects.set(project.id, project);
  logger.info(`Project updated: ${project.id}`);
  
  res.json({
    success: true,
    data: project,
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

router.delete('/:id', (req, res) => {
  const project = projects.get(req.params.id);
  
  if (!project) {
    res.status(404).json({
      success: false,
      error: {
        code: 'PROJECT_NOT_FOUND',
        message: `Project ${req.params.id} not found`,
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }
  
  projects.delete(req.params.id);
  logger.info(`Project deleted: ${req.params.id}`);
  
  res.json({
    success: true,
    data: { deleted: true },
    timestamp: new Date(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
});

export { router as projectsRouter };
