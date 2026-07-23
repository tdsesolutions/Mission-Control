import { describe, it, expect } from 'vitest';
import { cosineSimilarity, centroid, calibrateThreshold } from './math.js';

const v = (...xs: number[]) => Float32Array.from(xs);

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity(v(1, 2, 3), v(1, 2, 3))).toBeCloseTo(1, 6);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity(v(1, 0), v(0, 1))).toBeCloseTo(0, 6);
  });

  it('is -1 for opposite vectors', () => {
    expect(cosineSimilarity(v(1, 1), v(-1, -1))).toBeCloseTo(-1, 6);
  });

  it('rejects dimension mismatches and zero vectors', () => {
    expect(() => cosineSimilarity(v(1), v(1, 2))).toThrow(/mismatch/);
    expect(() => cosineSimilarity(v(0, 0), v(1, 1))).toThrow(/zero-norm/);
  });
});

describe('centroid', () => {
  it('averages element-wise', () => {
    const c = centroid([v(1, 0), v(3, 2)]);
    expect(Array.from(c)).toEqual([2, 1]);
  });

  it('rejects empty input', () => {
    expect(() => centroid([])).toThrow();
  });
});

describe('calibrateThreshold', () => {
  const opts = { floor: 0.35, ceiling: 0.6, fallback: 0.45 };

  it('falls back with fewer than 3 samples', () => {
    const cal = calibrateThreshold([v(1, 0), v(1, 0)], opts);
    expect(cal.threshold).toBe(0.45);
    expect(cal.pairCount).toBe(0);
  });

  it('clamps identical samples (std=0, raw=1) to the ceiling', () => {
    const cal = calibrateThreshold([v(1, 0), v(1, 0), v(1, 0)], opts);
    expect(cal.threshold).toBe(0.6);
    expect(cal.intraMean).toBeCloseTo(1, 6);
    expect(cal.intraStd).toBeCloseTo(0, 6);
  });

  it('clamps wildly-varying samples to the floor', () => {
    // Near-orthogonal "enrollment" — raw threshold would be far below floor.
    const cal = calibrateThreshold([v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)], opts);
    expect(cal.threshold).toBe(0.35);
  });

  it('sits below the genuine-score distribution for realistic variation', () => {
    // Slightly-jittered copies of one direction.
    const base = [1, 0.5, 0.25, 0.1];
    const jitter = (k: number) => Float32Array.from(base.map((x, i) => x + 0.02 * Math.sin(k * (i + 1))));
    const cal = calibrateThreshold([jitter(1), jitter(2), jitter(3), jitter(4)], opts);
    expect(cal.threshold).toBeLessThanOrEqual(cal.intraMean);
    expect(cal.threshold).toBeGreaterThanOrEqual(opts.floor);
    expect(cal.pairCount).toBe(4);
  });
});
