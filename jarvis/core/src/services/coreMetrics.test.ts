import { describe, it, expect } from 'vitest';
import { CoreMetrics, getCoreMetrics } from './coreMetrics.js';

describe('CoreMetrics', () => {
  it('reports zeroed request counters before any traffic', () => {
    const metrics = new CoreMetrics().getMetrics();
    expect(metrics.requestCount).toBe(0);
    expect(metrics.errorRate).toBe(0);
    expect(metrics.latency).toBe(0);
  });

  it('reports real process measurements', () => {
    const metrics = new CoreMetrics().getMetrics();
    expect(metrics.memoryUsage).toBeGreaterThan(0); // RSS of this test process, MB
    expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
    expect(metrics.cpuUsage).toBeLessThanOrEqual(999);
  });

  it('counts requests and computes error rate from 5xx responses', () => {
    const collector = new CoreMetrics();
    collector.recordRequest(10, 200);
    collector.recordRequest(20, 404); // 4xx is not a server error
    collector.recordRequest(30, 500);
    collector.recordRequest(40, 503);

    const metrics = collector.getMetrics();
    expect(metrics.requestCount).toBe(4);
    expect(metrics.errorRate).toBe(50);
  });

  it('reports mean latency over recorded requests', () => {
    const collector = new CoreMetrics();
    collector.recordRequest(10, 200);
    collector.recordRequest(20, 200);
    collector.recordRequest(30, 200);

    expect(collector.getMetrics().latency).toBe(20);
  });

  it('bounds the latency window', () => {
    const collector = new CoreMetrics();
    for (let i = 0; i < 150; i++) {
      collector.recordRequest(100, 200);
    }
    collector.recordRequest(0, 200);

    const metrics = collector.getMetrics();
    expect(metrics.requestCount).toBe(151);
    // Window holds the last 100 samples: 99 × 100ms + 1 × 0ms
    expect(metrics.latency).toBe(99);
  });

  it('exposes a stable shared instance', () => {
    expect(getCoreMetrics()).toBe(getCoreMetrics());
  });
});
