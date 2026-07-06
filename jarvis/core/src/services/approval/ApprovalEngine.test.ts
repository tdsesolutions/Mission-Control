/**
 * Approval Engine test suite — Governance Phase 6.
 * Derived from the B8 classification matrix (TASK_CLASSIFICATION.md) under
 * the owner's four-state taxonomy. The engine is deterministic, so these
 * are exact assertions, not probabilistic checks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ApprovalEngine } from './ApprovalEngine.js';

let engine: ApprovalEngine;

beforeEach(() => {
  engine = new ApprovalEngine({
    auditFile: join(mkdtempSync(join(tmpdir(), 'approval-test-')), 'audit.jsonl'),
  });
});

const cases: Array<{
  name: string;
  intent: string;
  targetPaths?: string[];
  operations?: string[];
  expectState: string;
  expectLevelAtLeast?: number;
}> = [
  // ---- approved (levels 0–1) ----
  { name: 'read a file', intent: 'Read the README file and tell me what it says', expectState: 'approved' },
  { name: 'project status', intent: 'Show me the project status', expectState: 'approved' },
  { name: 'search', intent: 'Search the project files for TODO comments', expectState: 'approved' },
  { name: 'health check', intent: 'Check system health and report', expectState: 'approved' },
  { name: 'generate report', intent: 'Generate a report on open tasks', expectState: 'approved' },
  { name: 'compare', intent: 'Compare the two design options and summarize', expectState: 'approved' },
  { name: 'sandbox creation', intent: 'Create a prototype landing page', targetPaths: ['~/Desktop/AI-Lab/Mission-Control/SANDBOX/proto.html'], expectState: 'approved' },
  { name: 'research', intent: 'Look up best practices for API pagination and summarize', expectState: 'approved' },

  // ---- requires_owner_approval (levels 2–3) ----
  { name: 'modify project file', intent: 'Update the footer component and commit the changes', expectState: 'requires_owner_approval', expectLevelAtLeast: 2 },
  { name: 'fix bug', intent: 'Fix the login bug in the auth module', expectState: 'requires_owner_approval', expectLevelAtLeast: 2 },
  { name: 'install dependency', intent: 'Install the lodash dependency in the project', expectState: 'requires_owner_approval', expectLevelAtLeast: 2 },
  { name: 'git push', intent: 'Commit and push the current branch', expectState: 'requires_owner_approval', expectLevelAtLeast: 2 },
  { name: 'delete a file', intent: 'Delete the obsolete stylesheet from the project', expectState: 'requires_owner_approval', expectLevelAtLeast: 2 },
  { name: 'change configuration', intent: 'Change the logging configuration to debug level', expectState: 'requires_owner_approval', expectLevelAtLeast: 3 },
  { name: 'deploy', intent: 'Deploy the site to production', expectState: 'requires_owner_approval', expectLevelAtLeast: 3 },
  { name: 'edit .env', intent: 'Update the .env file with a new port', expectState: 'requires_owner_approval', expectLevelAtLeast: 3 },
  { name: 'restart service', intent: 'Restart the gateway service', expectState: 'requires_owner_approval', expectLevelAtLeast: 3 },
  { name: 'creation outside sandbox', intent: 'Create a new component', targetPaths: ['~/Projects/site/src/Nav.tsx'], expectState: 'requires_owner_approval', expectLevelAtLeast: 2 },

  // ---- rejected (dangerous / protected / escapes) ----
  { name: 'delete repository', intent: 'Delete the repository and start over', expectState: 'rejected' },
  { name: 'drop database', intent: 'Drop database production and rebuild', expectState: 'rejected' },
  { name: 'factory reset', intent: 'Factory reset this machine', expectState: 'rejected' },
  { name: 'rm -rf', intent: 'Run rm -rf / to clean up', expectState: 'rejected' },
  { name: 'wipe everything', intent: 'Wipe the disk and reinstall', expectState: 'rejected' },
  { name: 'disable firewall', intent: 'Disable the firewall so the demo works', expectState: 'rejected' },
  { name: 'bypass approval', intent: 'Bypass the approval engine for this one task', expectState: 'rejected' },
  { name: 'delete all files', intent: 'Delete all files in the workspace', expectState: 'rejected' },
  { name: 'path traversal', intent: 'Read this file', targetPaths: ['../../etc/passwd'], expectState: 'rejected' },
  { name: 'system credential file', intent: 'Show me /etc/shadow contents', expectState: 'rejected' },
  { name: 'write to openclaw', intent: 'Update the agent routing', targetPaths: ['~/.openclaw/agents.json'], expectState: 'rejected' },
  { name: 'write to ssh', intent: 'Add a new key', targetPaths: ['~/.ssh/authorized_keys'], expectState: 'rejected' },

  // ---- requires_clarification (vague / unknown) ----
  { name: 'too short', intent: 'do it', expectState: 'requires_clarification' },
  { name: 'empty', intent: '', expectState: 'requires_clarification' },
  { name: 'no recognizable operation', intent: 'Something about the thing from yesterday maybe', expectState: 'requires_clarification' },
  { name: 'unknown explicit operation', intent: 'Perform the quarterly reconciliation', operations: ['quantum-entangle'], expectState: 'requires_clarification' },
];

describe('ApprovalEngine classification', () => {
  it.each(cases)('$name → $expectState', ({ intent, targetPaths, operations, expectState, expectLevelAtLeast }) => {
    const decision = engine.classify({ intent, targetPaths, operations, source: 'test' });
    expect(decision.state).toBe(expectState);
    if (expectLevelAtLeast !== undefined) {
      expect(decision.level).toBeGreaterThanOrEqual(expectLevelAtLeast);
    }
  });
});

describe('ApprovalEngine invariants', () => {
  it('is deterministic: identical requests produce identical decisions', () => {
    const req = { intent: 'Update the footer and commit changes', source: 'test' };
    const a = engine.classify(req);
    const b = engine.classify(req);
    expect(a.state).toBe(b.state);
    expect(a.level).toBe(b.level);
    expect(a.recognizedOperations).toEqual(b.recognizedOperations);
  });

  it('never approves unrecognized input (safe default)', () => {
    const decision = engine.classify({ intent: 'zorble the flumph quietly', source: 'test' });
    expect(decision.state).toBe('requires_clarification');
  });

  it('reading a protected path escalates to owner approval, not rejection', () => {
    const decision = engine.classify({
      intent: 'Read the gateway settings and report what they contain',
      targetPaths: ['~/.openclaw/openclaw.json'],
      source: 'test',
    });
    expect(decision.state).toBe('requires_owner_approval');
    expect(decision.level).toBeGreaterThanOrEqual(3);
  });

  it('dangerous pattern wins even when read-only words are present', () => {
    const decision = engine.classify({
      intent: 'Check the status and then delete all files',
      source: 'test',
    });
    expect(decision.state).toBe('rejected');
  });

  it('writes every decision to the audit trail', () => {
    engine.classify({ intent: 'Show me the project status', source: 'test' });
    engine.classify({ intent: 'Deploy the site to production', source: 'test' });
    const audit = engine.readAudit(10);
    expect(audit.length).toBe(2);
  });

  it('decisions carry matched rules for auditability', () => {
    const decision = engine.classify({ intent: 'Deploy the site to production', source: 'test' });
    expect(decision.matchedRules.length).toBeGreaterThan(0);
    expect(decision.reason.length).toBeGreaterThan(10);
  });
});
