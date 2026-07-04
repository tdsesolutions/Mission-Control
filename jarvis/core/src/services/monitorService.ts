/**
 * Monitor Service
 * Monitors Jarvis and connected services health
 */

import { logger } from '../utils/logger.js';
import { EventBus } from './eventBus.js';
import { config } from '../config/index.js';
import { PORTS } from '../../../shared/constants/index.js';
import type { ServiceStatus, ServiceMetrics, HealthCheckResponse } from '../../../shared/types/index.js';

interface ServiceConfig {
  name: string;
  port: number;
  healthEndpoint: string;
}

const SERVICES: ServiceConfig[] = [
  { name: 'openclaw-gateway', port: PORTS.OPENCLAW_GATEWAY, healthEndpoint: '/health' },
  { name: 'mission-control', port: PORTS.MISSION_CONTROL, healthEndpoint: '/api/health' },
  { name: 'jarvis-core', port: PORTS.JARVIS_CORE, healthEndpoint: '/health' },
];

export class MonitorService {
  private eventBus: EventBus;
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 30000; // 30 seconds
  private initialized = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Monitor Service...');

    // Initialize service statuses
    for (const service of SERVICES) {
      this.serviceStatuses.set(service.name, {
        name: service.name,
        status: 'unknown',
        lastCheck: new Date(),
        uptime: 0,
        version: 'unknown',
        port: service.port,
      });
    }

    // Start monitoring
    this.startMonitoring();

    this.initialized = true;
    logger.info('Monitor Service initialized');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Monitor Service...');
    
    this.stopMonitoring();
    
    logger.info('Monitor Service shutdown complete');
  }

  private startMonitoring(): void {
    // Initial check
    this.checkAllServices();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAllServices();
    }, this.checkIntervalMs);

    logger.info(`Started monitoring with ${this.checkIntervalMs}ms interval`);
  }

  private stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped monitoring');
    }
  }

  private async checkAllServices(): Promise<void> {
    for (const service of SERVICES) {
      await this.checkService(service);
    }
  }

  private async checkService(serviceConfig: ServiceConfig): Promise<void> {
    const url = `http://localhost:${serviceConfig.port}${serviceConfig.healthEndpoint}`;
    const previousStatus = this.serviceStatuses.get(serviceConfig.name)?.status;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json() as HealthCheckResponse;
        const newStatus: ServiceStatus = {
          name: serviceConfig.name,
          status: data.status === 'ok' ? 'healthy' : data.status,
          lastCheck: new Date(),
          uptime: data.uptime || 0,
          version: data.version || 'unknown',
          port: serviceConfig.port,
        };

        this.serviceStatuses.set(serviceConfig.name, newStatus);

        // Emit event if status changed
        if (previousStatus !== newStatus.status) {
          if (newStatus.status === 'healthy') {
            this.eventBus.emitEvent('service:healthy', 'info', 'monitor', `${serviceConfig.name} is healthy`);
          } else {
            this.eventBus.emitEvent('service:unhealthy', 'warning', 'monitor', `${serviceConfig.name} is ${newStatus.status}`);
          }
        }
      } else {
        this.updateUnhealthy(serviceConfig, `HTTP ${response.status}`);
      }
    } catch (error) {
      this.updateUnhealthy(serviceConfig, error instanceof Error ? error.message : 'Connection failed');
    }
  }

  private updateUnhealthy(serviceConfig: ServiceConfig, reason: string): void {
    const previousStatus = this.serviceStatuses.get(serviceConfig.name)?.status;
    
    const newStatus: ServiceStatus = {
      name: serviceConfig.name,
      status: 'unhealthy',
      lastCheck: new Date(),
      uptime: 0,
      version: 'unknown',
      port: serviceConfig.port,
    };

    this.serviceStatuses.set(serviceConfig.name, newStatus);

    if (previousStatus !== 'unhealthy') {
      this.eventBus.emitEvent('service:unhealthy', 'warning', 'monitor', `${serviceConfig.name} is unhealthy: ${reason}`);
    }
  }

  getServiceStatus(name: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(name);
  }

  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  getSystemHealth(): { healthy: boolean; services: ServiceStatus[] } {
    const services = this.getAllServiceStatuses();
    const healthy = services.every(s => s.status === 'healthy');
    return { healthy, services };
  }
}
