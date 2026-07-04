/**
 * Memory Service
 * Manages Jarvis memory persistence
 */

import { logger } from '../utils/logger.js';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

interface MemoryData {
  [key: string]: unknown;
}

export class MemoryService {
  private dataDir: string;
  private memoryFile: string;
  private memory: MemoryData = {};
  private initialized = false;

  constructor(dataDir = './memory') {
    this.dataDir = dataDir;
    this.memoryFile = join(dataDir, 'jarvis-memory.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Memory Service...');

    // Ensure data directory exists
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
      logger.info(`Created memory directory: ${this.dataDir}`);
    }

    // Load existing memory
    await this.loadMemory();

    this.initialized = true;
    logger.info('Memory Service initialized');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Memory Service...');
    
    // Save memory before shutdown
    await this.saveMemory();
    
    logger.info('Memory Service shutdown complete');
  }

  // Memory operations
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.memory[key] as T) ?? defaultValue;
  }

  set<T>(key: string, value: T): void {
    this.memory[key] = value;
    logger.debug(`Memory set: ${key}`);
  }

  delete(key: string): boolean {
    if (key in this.memory) {
      delete this.memory[key];
      logger.debug(`Memory deleted: ${key}`);
      return true;
    }
    return false;
  }

  has(key: string): boolean {
    return key in this.memory;
  }

  keys(): string[] {
    return Object.keys(this.memory);
  }

  clear(): void {
    this.memory = {};
    logger.info('Memory cleared');
  }

  getAll(): MemoryData {
    return { ...this.memory };
  }

  // Persistence
  async loadMemory(): Promise<void> {
    try {
      if (existsSync(this.memoryFile)) {
        const data = readFileSync(this.memoryFile, 'utf-8');
        this.memory = JSON.parse(data);
        logger.info(`Loaded memory from ${this.memoryFile}`);
      } else {
        logger.info('No existing memory file found, starting fresh');
      }
    } catch (error) {
      logger.error('Failed to load memory:', error);
      this.memory = {};
    }
  }

  async saveMemory(): Promise<void> {
    try {
      const data = JSON.stringify(this.memory, null, 2);
      writeFileSync(this.memoryFile, data, 'utf-8');
      logger.debug(`Memory saved to ${this.memoryFile}`);
    } catch (error) {
      logger.error('Failed to save memory:', error);
    }
  }
}
