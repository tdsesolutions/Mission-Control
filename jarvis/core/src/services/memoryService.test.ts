import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryService } from './memoryService.js';

describe('MemoryService', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'jarvis-memory-test-'));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('round-trips set/get/has/delete/keys', async () => {
    const memory = new MemoryService(dataDir);
    await memory.initialize();

    memory.set('alpha', { a: 1 });
    memory.set('beta', 'two');

    expect(memory.get('alpha')).toEqual({ a: 1 });
    expect(memory.has('beta')).toBe(true);
    expect(memory.keys().sort()).toEqual(['alpha', 'beta']);

    expect(memory.delete('alpha')).toBe(true);
    expect(memory.delete('alpha')).toBe(false);
    expect(memory.has('alpha')).toBe(false);
  });

  it('persists values across instances (restart survival)', async () => {
    const first = new MemoryService(dataDir);
    await first.initialize();
    first.set('persisted.key', { survived: true });
    await first.saveMemory();

    const second = new MemoryService(dataDir);
    await second.initialize();
    expect(second.get('persisted.key')).toEqual({ survived: true });
  });

  it('persists deletions', async () => {
    const first = new MemoryService(dataDir);
    await first.initialize();
    first.set('doomed', 1);
    await first.saveMemory();
    first.delete('doomed');
    await first.saveMemory();

    const second = new MemoryService(dataDir);
    await second.initialize();
    expect(second.has('doomed')).toBe(false);
  });
});
