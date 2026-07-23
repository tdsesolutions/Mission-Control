/**
 * JSONL audit trail, same shape philosophy as the Approval Engine's:
 * append-only, one decision per line, no audio, no embeddings — just the
 * score, the outcome, and where the utterance came from.
 */

import fs from 'fs';
import path from 'path';

export interface AuditEntry {
  ts: string;
  event: 'verify' | 'enroll' | 'voiceprint_deleted';
  profile: string;
  source: string;
  outcome: string;
  score?: number;
  threshold?: number;
  durationSeconds?: number;
}

export class AuditLog {
  private file: string;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'identity-audit.jsonl');
  }

  append(entry: Omit<AuditEntry, 'ts'>): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    fs.appendFileSync(this.file, line + '\n');
  }
}
