/**
 * Pending Approvals — the owner-approval workflow surface (2026-07-09).
 *
 * Dispatches the Approval Engine classified as `requires_owner_approval`
 * are held in Kiaros Core until the owner resolves them here. Approve →
 * the real Mission Control task is created; Deny → nothing is created.
 */

import { useCallback, useEffect, useState } from 'react';
import { coreHeaders } from '../services/coreAuth';
import { useJarvisStore } from '../stores/jarvisStore';
import { ShieldQuestion, Check, X, AlertCircle } from 'lucide-react';

interface PendingDispatch {
  id: string;
  intent: string;
  decision: { id: string; state: string; level: number; reason: string };
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  lastError?: string;
}

const POLL_MS = 10_000;

export function PendingApprovals() {
  const [pending, setPending] = useState<PendingDispatch[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3010/api/v1/approval/pending', {
        headers: coreHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setPending(data.data);
        }
      }
    } catch {
      // Core unreachable — the connection indicator already reports it.
    }
  }, []);

  // Bumped by Core push events (approval_required/granted/denied) so a
  // spoken "fix the login bug" surfaces here immediately.
  const approvalEventsNonce = useJarvisStore((state) => state.approvalEventsNonce);

  useEffect(() => {
    fetchPending();
    const timer = setInterval(fetchPending, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchPending, approvalEventsNonce]);

  const resolve = async (id: string, action: 'approve' | 'deny') => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(
        `http://localhost:3010/api/v1/approval/pending/${encodeURIComponent(id)}/${action}`,
        { method: 'POST', headers: { ...coreHeaders(), 'Content-Type': 'application/json' } },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setError(data?.error?.message ?? `Could not ${action} the dispatch.`);
      }
    } catch {
      setError('Kiaros Core is unreachable.');
    } finally {
      setBusyId(null);
      fetchPending();
    }
  };

  if (pending.length === 0 && !error) {
    return null; // Nothing awaiting the owner — keep the panel column quiet.
  }

  return (
    <div className="hud-panel mt-4" data-hue="gold">
      <div className="hud-panel-corner tl" />
      <div className="hud-panel-corner tr" />
      <div className="hud-panel-corner bl" />
      <div className="hud-panel-corner br" />

      <div className="hud-panel-header">
        <span className="icon-badge"><ShieldQuestion size={15} /></span>
        <span>Awaiting Your Approval</span>
        <span className="hud-panel-tagline">Nothing moves without your word.</span>
      </div>

      <div className="hud-panel-content">
        {error && (
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--j-error)]">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {pending.map((entry) => (
            <div
              key={entry.id}
              className="p-3 bg-[rgba(255,255,255,0.03)] rounded border border-[var(--j-bg-panel-border)]"
            >
              <p className="text-sm text-[var(--j-text-primary)] break-words">{entry.intent}</p>
              <p className="mt-1 text-[10px] uppercase text-[var(--j-text-muted)]">
                Level {entry.decision.level} — {entry.decision.reason}
              </p>
              {entry.lastError && (
                <p className="mt-1 text-xs text-[var(--j-warning)]">{entry.lastError}</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => resolve(entry.id, 'approve')}
                  disabled={busyId === entry.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[rgba(0,240,255,0.15)] text-[var(--j-primary)] hover:bg-[rgba(0,240,255,0.3)] disabled:opacity-50"
                >
                  <Check size={12} /> Approve
                </button>
                <button
                  onClick={() => resolve(entry.id, 'deny')}
                  disabled={busyId === entry.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[rgba(255,51,102,0.15)] text-[var(--j-error)] hover:bg-[rgba(255,51,102,0.3)] disabled:opacity-50"
                >
                  <X size={12} /> Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
