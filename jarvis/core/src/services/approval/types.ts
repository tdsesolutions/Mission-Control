/**
 * Approval Engine Types
 *
 * The Approval Engine is a DECISION AUTHORITY ONLY (owner mandate,
 * 2026-07-05). It classifies requests; it never executes work, never
 * modifies Mission Control, and never invokes OpenClaw. Execution is
 * someone else's job, gated on these decisions.
 *
 * Decisions are fully deterministic — no LLM or external provider is ever
 * consulted. A safety gate must give the same answer to the same request
 * every time, and must keep working with zero network and zero providers.
 */

/** Owner-defined decision states (2026-07-05). */
export type ApprovalState =
  | 'approved'                 // safe to proceed (B8 levels 0–1)
  | 'requires_owner_approval'  // owner must explicitly approve (B8 levels 2–3)
  | 'requires_clarification'   // intent too vague/ambiguous to classify safely
  | 'rejected';                // dangerous/forbidden (B8 level 4, escapes, protected targets)

/** B8 specification levels, retained as supporting metadata. */
export type ApprovalLevel = 0 | 1 | 2 | 3 | 4;

export interface ApprovalRequest {
  /** Natural-language statement of what is being requested. */
  intent: string;
  /** Optional explicit operation identifiers, if the caller already knows them. */
  operations?: string[];
  /** Optional filesystem/resource targets the request would touch. */
  targetPaths?: string[];
  /** Free-form requester tag for the audit trail (e.g. 'conversation', 'api'). */
  source?: string;
}

export interface MatchedRule {
  rule: string;
  detail: string;
}

export interface ApprovalDecision {
  id: string;
  state: ApprovalState;
  level: ApprovalLevel;
  /** Human-readable explanation of the decision. */
  reason: string;
  /** Operations the engine recognized in the request. */
  recognizedOperations: string[];
  /** Every rule that influenced the decision, for auditability. */
  matchedRules: MatchedRule[];
  timestamp: string;
  source: string;
}
