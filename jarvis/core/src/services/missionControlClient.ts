/**
 * Mission Control Client
 * Handles communication with Mission Control
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

interface MissionControlConfig {
  url: string;
  apiKey: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

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

    // Test connection
    await this.checkHealth();

    this.initialized = true;
    logger.info('Mission Control Client initialized');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Mission Control Client...');
    this.connected = false;
    logger.info('Mission Control Client shutdown complete');
  }

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.config.url}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json() as { status?: string };
        this.connected = data.status === 'healthy' || data.status === 'ok';
        
        if (this.connected) {
          logger.info('Connected to Mission Control');
        } else {
          logger.warn('Mission Control health check returned unhealthy status');
        }
        
        return this.connected;
      } else {
        this.connected = false;
        logger.warn(`Mission Control health check failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      this.connected = false;
      logger.warn('Mission Control is not reachable:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Generic API request method
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.config.url}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json() as ApiResponse<T>;
      return data;
    } catch (error) {
      logger.error(`Request to ${endpoint} failed:`, error);
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Task operations
  async getTasks(): Promise<ApiResponse<unknown[]>> {
    return this.request('/api/tasks');
  }

  async createTask(taskData: unknown): Promise<ApiResponse<unknown>> {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(taskId: string, updates: unknown): Promise<ApiResponse<unknown>> {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Project operations
  async getProjects(): Promise<ApiResponse<unknown[]>> {
    return this.request('/api/projects');
  }

  async createProject(projectData: unknown): Promise<ApiResponse<unknown>> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  // Agent operations
  async getAgents(): Promise<ApiResponse<unknown[]>> {
    return this.request('/api/agents');
  }

  async dispatchTask(agentId: string, taskData: unknown): Promise<ApiResponse<unknown>> {
    return this.request(`/api/agents/${agentId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }
}
