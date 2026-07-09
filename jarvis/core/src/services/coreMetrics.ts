/**
 * Core Process Metrics
 * Real measurements for the jarvis-core process itself, matching the
 * ServiceMetrics contract (shared/types). Units: cpuUsage = % of one core
 * since the previous read, memoryUsage = RSS in MB, errorRate = % of
 * requests with 5xx status, latency = mean response time (ms) over the
 * last LATENCY_WINDOW requests. Request data is fed by the HTTP
 * middleware in index.ts.
 */

import type { ServiceMetrics } from '../../../shared/types/index.js';

const LATENCY_WINDOW = 100;

export class CoreMetrics {
  private lastCpu = process.cpuUsage();
  private lastCpuAt = process.hrtime.bigint();
  private requestCount = 0;
  private errorCount = 0;
  private latencies: number[] = [];

  recordRequest(durationMs: number, statusCode: number): void {
    this.requestCount += 1;
    if (statusCode >= 500) {
      this.errorCount += 1;
    }
    this.latencies.push(durationMs);
    if (this.latencies.length > LATENCY_WINDOW) {
      this.latencies.shift();
    }
  }

  /**
   * CPU busy % of one core across the window since the previous read
   * (first read measures since process start). Reading advances the window.
   */
  private sampleCpuPercent(): number {
    const now = process.hrtime.bigint();
    const elapsedUs = Number(now - this.lastCpuAt) / 1000;
    const cpu = process.cpuUsage(this.lastCpu);
    this.lastCpu = process.cpuUsage();
    this.lastCpuAt = now;

    if (elapsedUs <= 0) {
      return 0;
    }
    const busyPercent = ((cpu.user + cpu.system) / elapsedUs) * 100;
    return Math.round(Math.min(busyPercent, 999) * 10) / 10;
  }

  getMetrics(): ServiceMetrics {
    const meanLatency = this.latencies.length
      ? this.latencies.reduce((sum, ms) => sum + ms, 0) / this.latencies.length
      : 0;

    return {
      cpuUsage: this.sampleCpuPercent(),
      memoryUsage: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      requestCount: this.requestCount,
      errorRate: this.requestCount
        ? Math.round((this.errorCount / this.requestCount) * 1000) / 10
        : 0,
      latency: Math.round(meanLatency),
    };
  }
}

let sharedInstance: CoreMetrics | null = null;

/** Shared collector — the middleware writes to it, status routes read it. */
export function getCoreMetrics(): CoreMetrics {
  if (!sharedInstance) {
    sharedInstance = new CoreMetrics();
  }
  return sharedInstance;
}
