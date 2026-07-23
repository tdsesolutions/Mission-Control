/**
 * Owner approve command — spoken/typed approval of waiting work
 * (owner-approved 2026-07-23).
 *
 * "approve task 4, execute code NNNN" (or "approve it" / "accept that",
 * with the code) resolves whatever is waiting on the owner:
 *   1. an explicitly named Mission Control task in the review column, or
 *   2. the newest Core-held dispatch awaiting owner approval, or
 *   3. the newest Mission Control task in review.
 *
 * SECURITY INVARIANTS (E-3 owner decision — approvals are gated):
 * - Without a verified execute code the command NEVER mutates anything; the
 *   reply asks for the code and is identical whether the code was absent or
 *   wrong (no oracle).
 * - Detection is deterministic (regex on the imperative verb) — the LLM is
 *   never trusted to decide that an approval happened.
 * - Only review-state tasks can be accepted (enforced again in
 *   MissionControlClient.acceptReviewTask); running or queued work cannot
 *   be force-completed through this path.
 */

import type { Task } from '../../../../shared/types/index.js';

/** Message must START with the approval verb — mentions of "approve" mid-
 * sentence ("did you approve it?") are conversation, not commands. */
const APPROVE_PATTERN =
  /^\s*(?:(?:please|kiaros|ok(?:ay)?|yes)[,\s]+)*(?:approve|accept|sign\s*off(?:\s+on)?)\b/i;

const TASK_ID_PATTERN = /\btask\s*(?:#|number\s*)?(\d+)\b/i;

export interface ApproveCommandParse {
  isApprove: boolean;
  /** Explicit Mission Control task id, when the owner named one. */
  taskId?: string;
}

export function parseApproveCommand(content: string): ApproveCommandParse {
  if (!APPROVE_PATTERN.test(content)) return { isApprove: false };
  const id = content.match(TASK_ID_PATTERN);
  return { isApprove: true, taskId: id?.[1] };
}

// ---------------------------------------------------------------------------
// Execution — dependencies injected so the flow is unit-testable without a
// live Mission Control or dispatcher.
// ---------------------------------------------------------------------------

export interface ApproveCommandDeps {
  /** MissionControlClient.acceptReviewTask */
  acceptReviewTask(id: string, note: string): Promise<{ ok: boolean; data?: Task; error?: string }>;
  /** MissionControlClient.listTasks filtered to review */
  listReviewTasks(): Promise<Task[]>;
  /** TaskDispatcher.listPending(false) */
  listPendingDispatches(): Array<{ id: string; intent: string }>;
  /** TaskDispatcher.approvePending */
  approvePendingDispatch(id: string): Promise<{ ok: boolean; error?: string; taskId?: string }>;
}

export interface ApproveCommandResult {
  outcome: 'accepted_review' | 'released_dispatch' | 'needs_code' | 'nothing_waiting' | 'failed';
  /** Spoken-friendly reply for the owner (1–2 short sentences). */
  message: string;
  taskId?: string;
}

const ACCEPT_NOTE =
  'Approved by owner via Kiaros (execute code verified) — accepted from review.';

export async function runApproveCommand(
  deps: ApproveCommandDeps,
  parse: ApproveCommandParse,
  execAuthorized: boolean
): Promise<ApproveCommandResult> {
  // One reply for both "no code" and "wrong code": never confirm a guess.
  if (!execAuthorized) {
    return {
      outcome: 'needs_code',
      message:
        'Approving needs your execute code — say it again with the code, for example "approve task 4, execute code ...".',
    };
  }

  if (parse.taskId) {
    const result = await deps.acceptReviewTask(parse.taskId, ACCEPT_NOTE);
    if (result.ok) {
      return {
        outcome: 'accepted_review',
        taskId: parse.taskId,
        message: `Task ${parse.taskId} approved — it's closed out in Mission Control.`,
      };
    }
    return {
      outcome: 'failed',
      taskId: parse.taskId,
      message: `I couldn't approve task ${parse.taskId}: ${result.error ?? 'Mission Control did not respond.'}`,
    };
  }

  // No explicit id: work not yet started (held dispatches) takes priority
  // over finished work awaiting acceptance — "approve it" most naturally
  // means the thing that is blocked from running.
  const pending = deps.listPendingDispatches();
  if (pending.length > 0) {
    const newest = pending[pending.length - 1];
    const released = await deps.approvePendingDispatch(newest.id);
    if (released.ok) {
      return {
        outcome: 'released_dispatch',
        taskId: released.taskId,
        message: `Approved — that request is now running${released.taskId ? ` as task ${released.taskId}` : ''}.`,
      };
    }
    return {
      outcome: 'failed',
      message: `I couldn't release the held request: ${released.error ?? 'Mission Control did not respond.'}`,
    };
  }

  const inReview = await deps.listReviewTasks();
  if (inReview.length > 0) {
    const newest = [...inReview].sort((a, b) => Number(a.id) - Number(b.id))[inReview.length - 1];
    const result = await deps.acceptReviewTask(newest.id, ACCEPT_NOTE);
    if (result.ok) {
      return {
        outcome: 'accepted_review',
        taskId: newest.id,
        message: `Task ${newest.id} approved — it's closed out in Mission Control.`,
      };
    }
    return {
      outcome: 'failed',
      taskId: newest.id,
      message: `I couldn't approve task ${newest.id}: ${result.error ?? 'Mission Control did not respond.'}`,
    };
  }

  return {
    outcome: 'nothing_waiting',
    message: 'Nothing is waiting on your approval right now — no held requests and nothing in review.',
  };
}
