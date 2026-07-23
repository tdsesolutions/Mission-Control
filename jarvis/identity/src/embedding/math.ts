/**
 * Embedding math: cosine similarity, centroid, and threshold calibration.
 * Pure functions — the unit-testable heart of verification.
 */

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) {
    throw new Error(`embedding dimension mismatch (${a.length} vs ${b.length})`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) throw new Error('zero-norm embedding');
  return dot / denom;
}

export function centroid(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) throw new Error('cannot average zero embeddings');
  const dim = embeddings[0].length;
  const out = new Float32Array(dim);
  for (const e of embeddings) {
    if (e.length !== dim) throw new Error('embedding dimension mismatch in centroid');
    for (let i = 0; i < dim; i++) out[i] += e[i];
  }
  for (let i = 0; i < dim; i++) out[i] /= embeddings.length;
  return out;
}

export interface Calibration {
  threshold: number;
  intraMean: number;
  intraStd: number;
  pairCount: number;
}

/**
 * Calibrate the acceptance threshold from the enrollment samples themselves.
 * Leave-one-out: each sample is scored against the centroid of the others,
 * giving a distribution of "genuine owner" scores. The threshold sits below
 * that distribution (mean − 2·std) so normal variation passes, clamped to
 * [floor, ceiling] so a too-tight or too-loose calibration can never make
 * the gate useless.
 */
export function calibrateThreshold(
  embeddings: Float32Array[],
  opts: { floor: number; ceiling: number; fallback: number }
): Calibration {
  if (embeddings.length < 3) {
    return { threshold: opts.fallback, intraMean: NaN, intraStd: NaN, pairCount: 0 };
  }
  const scores: number[] = [];
  for (let i = 0; i < embeddings.length; i++) {
    const others = embeddings.filter((_, j) => j !== i);
    scores.push(cosineSimilarity(embeddings[i], centroid(others)));
  }
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  const variance =
    scores.reduce((s, x) => s + (x - mean) * (x - mean), 0) / scores.length;
  const std = Math.sqrt(variance);
  const raw = mean - 2 * std;
  const threshold = Math.min(opts.ceiling, Math.max(opts.floor, raw));
  return { threshold, intraMean: mean, intraStd: std, pairCount: scores.length };
}
