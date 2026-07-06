/**
 * Approval Engine — Governance Phase 6
 *
 * Decision authority ONLY. Classifies a request as:
 *   approved | requires_owner_approval | requires_clarification | rejected
 *
 * Invariants (owner mandate + Constitution):
 * - Never executes work. The only side effects are an audit-log append and
 *   an event-bus notification.
 * - Never modifies Mission Control, never invokes OpenClaw.
 * - Fully deterministic: same request → same decision. No LLM, no provider,
 *   no network. Works with every LLM provider absent or down.
 * - Safe defaults: an unrecognizable request is 'requires_clarification',
 *   never 'approved'.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../../utils/logger.js';
import type { EventBus } from '../eventBus.js';
import type {
  ApprovalDecision,
  ApprovalLevel,
  ApprovalRequest,
  ApprovalState,
  MatchedRule,
} from './types.js';
import {
  DANGEROUS_PATTERNS,
  TRAVERSAL_PATTERNS,
  PROTECTED_PATH_PREFIXES,
  SANDBOX_PATH_PREFIXES,
  OPERATION_RULES,
  WRITE_CLASS_OPERATIONS,
  levelToState,
} from './rules.js';

const MIN_MEANINGFUL_INTENT_LENGTH = 8;

const STATE_EVENT: Record<ApprovalState, 'approval_granted' | 'approval_required' | 'approval_denied'> = {
  approved: 'approval_granted',
  requires_owner_approval: 'approval_required',
  requires_clarification: 'approval_required',
  rejected: 'approval_denied',
};

export class ApprovalEngine {
  private eventBus: EventBus | null = null;
  private readonly auditFile: string;

  constructor(options?: { auditFile?: string }) {
    this.auditFile = options?.auditFile ?? join(process.cwd(), 'logs', 'approval-audit.jsonl');
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Classify a request. Pure decision — performs no work on the request's
   * behalf regardless of outcome.
   */
  classify(request: ApprovalRequest): ApprovalDecision {
    const intent = (request.intent || '').trim();
    const targetPaths = request.targetPaths ?? [];
    const source = request.source ?? 'api';
    const matchedRules: MatchedRule[] = [];

    const decision = this.evaluate(intent, request.operations ?? [], targetPaths, matchedRules);

    const full: ApprovalDecision = {
      id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...decision,
      matchedRules,
      timestamp: new Date().toISOString(),
      source,
    };

    this.audit(full, intent);
    return full;
  }

  private evaluate(
    intent: string,
    explicitOperations: string[],
    targetPaths: string[],
    matchedRules: MatchedRule[],
  ): Omit<ApprovalDecision, 'id' | 'timestamp' | 'source' | 'matchedRules'> {
    // 1. Empty/vague intent → clarification (safe default, never approve).
    if (intent.length < MIN_MEANINGFUL_INTENT_LENGTH) {
      matchedRules.push({ rule: 'vague-intent', detail: 'intent below minimum meaningful length' });
      return {
        state: 'requires_clarification',
        level: 0,
        reason: 'The request is too short or vague to classify safely. Please restate it with what should be done and to what.',
        recognizedOperations: [],
      };
    }

    // 2. Dangerous patterns → rejected, regardless of anything else.
    for (const { pattern, detail } of DANGEROUS_PATTERNS) {
      if (pattern.test(intent)) {
        matchedRules.push({ rule: 'dangerous-pattern', detail });
        return {
          state: 'rejected',
          level: 4,
          reason: `Rejected: dangerous operation detected (${detail}). This class of request is never executed automatically.`,
          recognizedOperations: [],
        };
      }
    }

    // 3. Sandbox-escape signals in intent or target paths → rejected.
    const traversalHaystacks = [intent, ...targetPaths];
    for (const haystack of traversalHaystacks) {
      for (const { pattern, detail } of TRAVERSAL_PATTERNS) {
        if (pattern.test(haystack)) {
          matchedRules.push({ rule: 'sandbox-escape', detail });
          return {
            state: 'rejected',
            level: 4,
            reason: `Rejected: sandbox-escape signal detected (${detail}).`,
            recognizedOperations: [],
          };
        }
      }
    }

    // 4. Recognize operations from intent text + explicit list.
    const recognized = new Map<string, ApprovalLevel>();
    for (const rule of OPERATION_RULES) {
      if (rule.keywords.test(intent) || explicitOperations.includes(rule.operation)) {
        recognized.set(rule.operation, rule.level);
        matchedRules.push({ rule: `operation:${rule.operation}`, detail: `level ${rule.level}` });
      }
    }
    // Explicit operations the vocabulary doesn't know are a classification
    // gap → clarification rather than a silent guess.
    const unknownExplicit = explicitOperations.filter(
      (op) => !OPERATION_RULES.some((rule) => rule.operation === op),
    );
    if (unknownExplicit.length > 0) {
      matchedRules.push({ rule: 'unknown-operation', detail: unknownExplicit.join(', ') });
      return {
        state: 'requires_clarification',
        level: 0,
        reason: `Unknown operation(s): ${unknownExplicit.join(', ')}. The approval vocabulary does not cover these; please describe the request differently.`,
        recognizedOperations: [...recognized.keys()],
      };
    }

    if (recognized.size === 0) {
      matchedRules.push({ rule: 'no-recognized-operation', detail: 'nothing in the approval vocabulary matched' });
      return {
        state: 'requires_clarification',
        level: 0,
        reason: 'No recognizable operation found in the request. Please state concretely what should be done.',
        recognizedOperations: [],
      };
    }

    // 5. Task level = MAX of recognized operation levels (B8 §Level Assignment).
    let level = Math.max(...recognized.values()) as ApprovalLevel;
    const hasWriteClass = [...recognized.keys()].some((op) => WRITE_CLASS_OPERATIONS.has(op));

    // 6. Path validation (B8 §Path Validation).
    for (const rawPath of targetPaths) {
      const path = rawPath.trim();
      const isProtected = PROTECTED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
      const isSandbox = SANDBOX_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

      if (isProtected) {
        if (hasWriteClass) {
          // Writing to protected territory (e.g. ~/.openclaw) is a
          // constitutional violation, not an approvable request.
          matchedRules.push({ rule: 'protected-path-write', detail: path });
          return {
            state: 'rejected',
            level: 4,
            reason: `Rejected: write-class operation targeting protected path ${path}. Protected system areas are never modified (Constitution Art. III).`,
            recognizedOperations: [...recognized.keys()],
          };
        }
        matchedRules.push({ rule: 'protected-path-read', detail: path });
        level = Math.max(level, 3) as ApprovalLevel;
      } else if (!isSandbox && level === 1) {
        // Creation outside the sandbox escalates to project-level (B8).
        matchedRules.push({ rule: 'outside-sandbox', detail: path });
        level = 2;
      }
    }

    // 7. Map level to the owner's taxonomy.
    const state = levelToState(level);
    const reasonByState: Record<string, string> = {
      approved: `Approved: read-only or sandboxed operation (level ${level}).`,
      requires_owner_approval: `Owner approval required: ${level >= 3 ? 'configuration/system-level' : 'project-modifying'} operation (level ${level}).`,
      rejected: `Rejected: destructive operation class (level ${level}).`,
    };

    return {
      state,
      level,
      reason: reasonByState[state],
      recognizedOperations: [...recognized.keys()],
    };
  }

  /** Append to the JSONL audit trail and notify the event bus. Never throws. */
  private audit(decision: ApprovalDecision, intent: string): void {
    try {
      const dir = dirname(this.auditFile);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      appendFileSync(
        this.auditFile,
        JSON.stringify({ ...decision, intent: intent.slice(0, 300) }) + '\n',
        'utf-8',
      );
    } catch (error) {
      logger.error('Approval audit write failed:', error);
    }

    this.eventBus?.emitEvent(
      STATE_EVENT[decision.state],
      decision.state === 'rejected' ? 'warning' : 'info',
      'approval-engine',
      `${decision.state} (level ${decision.level}): ${intent.slice(0, 120)}`,
      { decisionId: decision.id, level: decision.level, state: decision.state },
    );

    logger.info(`Approval decision ${decision.id}: ${decision.state} (level ${decision.level})`);
  }

  /** Read recent audit entries (newest last). Read-only. */
  readAudit(limit = 50): unknown[] {
    try {
      if (!existsSync(this.auditFile)) return [];
      const lines = readFileSync(this.auditFile, 'utf-8').trim().split('\n');
      return lines.slice(-limit).map((line) => JSON.parse(line));
    } catch (error) {
      logger.error('Approval audit read failed:', error);
      return [];
    }
  }
}

let sharedInstance: ApprovalEngine | null = null;

/** Shared engine instance (route modules + service container). */
export function getApprovalEngine(): ApprovalEngine {
  if (!sharedInstance) {
    sharedInstance = new ApprovalEngine();
  }
  return sharedInstance;
}
