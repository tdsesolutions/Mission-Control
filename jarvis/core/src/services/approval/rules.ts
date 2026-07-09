/**
 * Approval Engine Rules
 *
 * Deterministic rule tables, implementing the Phase B8 specification
 * (APPROVAL_ENGINE.md, WORKFLOW_RULES.md, TASK_CLASSIFICATION.md) under the
 * owner's four-state taxonomy. Changing safety behavior means changing THIS
 * FILE — reviewable, diffable, testable.
 */

import type { ApprovalLevel } from './types.js';

/** Dangerous patterns — immediate rejection (B8 auto-block list). */
export const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; detail: string }> = [
  // Destructive
  { pattern: /delete\s+((all|everything|the)\s+)?(repos?itor(y|ies)|databases?)/i, detail: 'destroy repository/database' },
  { pattern: /drop\s+(database|table|schema)/i, detail: 'drop database object' },
  { pattern: /factory\s+reset/i, detail: 'factory reset' },
  { pattern: /rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*\s+[/~]/i, detail: 'recursive force delete from root/home' },
  { pattern: /format\s+(the\s+)?(drive|disk|volume)/i, detail: 'format storage' },
  { pattern: /wipe\s+(the\s+)?(disk|drive|system|machine|everything)/i, detail: 'wipe storage/system' },
  { pattern: /delete\s+all\s+files/i, detail: 'bulk file deletion' },
  { pattern: /remove\s+everything/i, detail: 'bulk removal' },
  // Security
  { pattern: /disable\s+(the\s+)?firewall/i, detail: 'disable firewall' },
  { pattern: /turn\s+off\s+(the\s+)?security/i, detail: 'disable security' },
  { pattern: /bypass\s+(authentication|auth|approval|the\s+approval\s+engine)/i, detail: 'bypass security/approval gate' },
  // System
  { pattern: /delete\s+(the\s+)?system/i, detail: 'delete system' },
  { pattern: /remove\s+(the\s+)?operating\s+system/i, detail: 'remove OS' },
  { pattern: /uninstall\s+everything/i, detail: 'bulk uninstall' },
];

/** Path fragments that indicate sandbox-escape attempts — rejection (B8 BLOCKED). */
export const TRAVERSAL_PATTERNS: Array<{ pattern: RegExp; detail: string }> = [
  { pattern: /\.\.[\\/]/, detail: 'path traversal (../)' },
  { pattern: /\/etc\/(passwd|shadow|sudoers)/i, detail: 'system credential file' },
];

/**
 * Protected path prefixes — targeting these escalates to owner approval at
 * minimum level 3 (B8 escalation). Note ~/.openclaw: the Constitution forbids
 * modification outright, so WRITE-class operations against it are rejected.
 */
export const PROTECTED_PATH_PREFIXES: string[] = [
  '~/.openclaw',
  '~/.ssh',
  '~/.config',
  '~/Library',
  '/etc',
  '/System',
  '/usr',
];

/** Paths under these prefixes are the designated sandbox (stay level 1). */
export const SANDBOX_PATH_PREFIXES: string[] = [
  '~/Desktop/AI-Lab/Mission-Control/SANDBOX',
  '~/Desktop/AI-Lab/sandbox',
];

/**
 * Operation vocabulary → level mapping (B8 §Operation Mapping). Keyword sets
 * are matched against the intent text and any explicit operations list.
 */
export const OPERATION_RULES: Array<{
  operation: string;
  level: ApprovalLevel;
  keywords: RegExp;
}> = [
  // LEVEL 0 — read-only
  { operation: 'read', level: 0, keywords: /\b(read|show|view|display|open)\b/i },
  { operation: 'list', level: 0, keywords: /\b(list|enumerate)\b/i },
  { operation: 'search', level: 0, keywords: /\b(search|find|grep|look\s+up|locate)\b/i },
  { operation: 'status', level: 0, keywords: /\b(status|health|check|monitor|inspect)\b/i },
  { operation: 'report', level: 0, keywords: /\b(report|summar(y|ize|ise)|analy(ze|se|sis)|review)\b/i },
  { operation: 'compare', level: 0, keywords: /\b(compare|diff|contrast)\b/i },

  // LEVEL 1 — sandboxed creation
  { operation: 'generate', level: 1, keywords: /\b(generate|draft|compose|prototype|scaffold)\b/i },
  { operation: 'create', level: 1, keywords: /\b(create|make|write|add|new)\b/i },
  { operation: 'test', level: 1, keywords: /\b(test|try\s+out|experiment)\b/i },

  // LEVEL 2 — project modification
  { operation: 'modify', level: 2, keywords: /\b(modify|update|edit|change|fix|patch|refactor|rename|redesign)\b/i },
  { operation: 'commit', level: 2, keywords: /\b(commit|merge|push|pull\s+request)\b/i },
  { operation: 'build', level: 2, keywords: /\b(build|compile|bundle)\b/i },
  { operation: 'install-dep', level: 2, keywords: /\b(install|add\s+dependency|npm\s+i|pnpm\s+add)\b/i },
  { operation: 'delete-file', level: 2, keywords: /\b(delete|remove)\b/i },

  // LEVEL 3 — configuration / system-level
  // Note: no bare "settings" keyword — nouns appear in read requests
  // ("read the gateway settings") and must not imply a write-class op.
  { operation: 'configure', level: 3, keywords: /\b(configur(e|ation)|environment\s+variable)\b|\.env\b/i },
  { operation: 'deploy', level: 3, keywords: /\b(deploy|publish|release|ship|go\s+live)\b/i },
  { operation: 'system', level: 3, keywords: /\b(system\s+(change|setting)|shell\s+profile|global(ly)?\s+install|launchagent|cron(tab)?)\b/i },
  { operation: 'restart-service', level: 3, keywords: /\b(restart|reboot|stop|kill|shut\s*down)\b/i },
];

/**
 * WRITE-class operations: these against a protected path are constitutional
 * violations (e.g. modifying ~/.openclaw) and are rejected, not escalated.
 */
export const WRITE_CLASS_OPERATIONS = new Set([
  'create', 'generate', 'test', 'modify', 'commit', 'build', 'install-dep',
  'delete-file', 'configure', 'deploy', 'system', 'restart-service',
]);

/** Map a B8 level to the owner's four-state taxonomy. */
export function levelToState(level: ApprovalLevel): 'approved' | 'requires_owner_approval' | 'rejected' {
  if (level >= 4) return 'rejected';
  if (level >= 2) return 'requires_owner_approval';
  return 'approved';
}
