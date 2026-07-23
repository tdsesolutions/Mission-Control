/**
 * Voiceprint persistence. One owner voiceprint per profile (desktop now,
 * pocket later), stored as JSON under jarvis/.data/identity — gitignored,
 * local-only, atomically written. No raw audio is ever persisted.
 */

import fs from 'fs';
import path from 'path';

export interface Voiceprint {
  version: 1;
  profile: string;
  dim: number;
  centroid: number[];
  threshold: number;
  sampleCount: number;
  calibration: { intraMean: number; intraStd: number; pairCount: number };
  createdAt: string;
  updatedAt: string;
}

export class VoiceprintStore {
  constructor(private dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  private fileFor(profile: string): string {
    if (!/^[a-z0-9-]{1,32}$/.test(profile)) throw new Error(`invalid profile name: ${profile}`);
    return path.join(this.dataDir, `voiceprint-${profile}.json`);
  }

  load(profile: string): Voiceprint | null {
    const file = this.fileFor(profile);
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Voiceprint;
    if (parsed.version !== 1 || !Array.isArray(parsed.centroid)) {
      throw new Error(`corrupt voiceprint file: ${file}`);
    }
    return parsed;
  }

  save(voiceprint: Voiceprint): void {
    const file = this.fileFor(voiceprint.profile);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(voiceprint, null, 2));
    fs.renameSync(tmp, file); // atomic on the same filesystem
  }

  delete(profile: string): boolean {
    const file = this.fileFor(profile);
    if (!fs.existsSync(file)) return false;
    fs.unlinkSync(file);
    return true;
  }
}
