/**
 * Owner execute-code extraction (owner-approved 2026-07-23).
 *
 * The owner can pre-authorize a request in the same breath as giving it:
 *   "tell claw to audit the testing project, execute code 4721"
 * When the spoken/typed code matches KIAROS_EXEC_CODE, the dispatch is
 * treated as owner-pre-approved (level ≤ 2 only — level 3+ is never
 * bypassable) and the Mission Control task is tagged auto_accept so
 * completed work closes itself instead of parking in the review column.
 *
 * PIN hygiene: the code phrase is stripped from the content BEFORE it goes
 * anywhere — task descriptions, audit trails, conversation history, or the
 * LLM. Nothing downstream ever sees the digits.
 */

export interface ExecCodeExtraction {
  /** Content with the code phrase removed (safe to store/dispatch). */
  cleaned: string;
  /** A code phrase was present in the content. */
  codePresent: boolean;
  /** The code matched the configured KIAROS_EXEC_CODE. */
  authorized: boolean;
}

/**
 * Matches: "execute code 4721", "exec code 4721", "authorization code 4721",
 * "auth code 4721", "execute 4721", "pin 4721" — tolerant of punctuation
 * and spaced digits ("4 7 2 1", which STT engines sometimes emit).
 */
const EXEC_CODE_PATTERN =
  /[,.;\s]*\b(?:execute|exec|authori[sz]ation|auth|pin)\s*(?:code\s*)?[:\-]?\s*((?:\d[\s-]?){4,8})\b[.!?]?/i;

export function extractExecCode(content: string, configuredCode: string | null | undefined): ExecCodeExtraction {
  const match = content.match(EXEC_CODE_PATTERN);
  if (!match) {
    return { cleaned: content, codePresent: false, authorized: false };
  }

  const spokenCode = match[1].replace(/[\s-]/g, '');
  const cleaned = content.replace(EXEC_CODE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
  const authorized = Boolean(configuredCode) && spokenCode === String(configuredCode).trim();

  return { cleaned, codePresent: true, authorized };
}
