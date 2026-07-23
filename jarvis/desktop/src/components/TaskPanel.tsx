import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { coreHeaders } from '../services/coreAuth';
import { useJarvisStore } from '../stores/jarvisStore';
import { CheckCircle2, Clock, AlertCircle, ListTodo, Ban, XCircle, RefreshCw, ClipboardCheck } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'needs_review' | 'blocked' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  // Inline approval flow for needs_review tasks: which task has the code
  // prompt open, the typed execute code, and the last error (if any).
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [execCode, setExecCode] = useState('');
  const [approveBusy, setApproveBusy] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  // Bumped by Core push events (task_created/completed/failed) — refetch
  // immediately when Kiaros dispatches work instead of waiting for the poll.
  const taskEventsNonce = useJarvisStore((state) => state.taskEventsNonce);

  useEffect(() => {
    fetchTasks();
    // Kiaros can now create MC tasks from conversation — keep the queue
    // fresh without waiting for a manual refresh.
    const timer = setInterval(fetchTasks, 15_000);
    return () => clearInterval(timer);
  }, [taskEventsNonce]);

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:3010/api/v1/tasks', {
        headers: coreHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          // Real Mission Control tasks via the Core read-through proxy
          setTasks(data.data.slice(0, 5));
          setDegraded(false);
        } else if (data.error?.code === 'MISSION_CONTROL_UNAVAILABLE') {
          // Honest degraded state: MC is unreachable — say so, don't
          // pretend the queue is empty.
          setTasks([]);
          setDegraded(true);
        }
      }
    } catch {
      setDegraded(true);
    } finally {
      setLoading(false);
    }
  };

  const openApprove = (taskId: string) => {
    setApprovingId(taskId);
    setExecCode('');
    setApproveError(null);
  };

  const submitApprove = async (taskId: string) => {
    if (!execCode.trim() || approveBusy) return;
    setApproveBusy(true);
    setApproveError(null);
    try {
      const response = await fetch(`http://localhost:3010/api/v1/tasks/${encodeURIComponent(taskId)}/approve`, {
        method: 'POST',
        headers: coreHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ execCode: execCode.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        setApprovingId(null);
        setExecCode('');
        fetchTasks();
      } else {
        setApproveError(
          data?.error?.code === 'EXEC_CODE_REQUIRED'
            ? 'Execute code not accepted.'
            : data?.error?.message ?? 'Approval failed — Mission Control did not respond.'
        );
      }
    } catch {
      setApproveError('Approval failed — Kiaros Core unreachable.');
    } finally {
      setApproveBusy(false);
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={14} className="text-[var(--j-success)]" />;
      case 'in_progress':
        return <Clock size={14} className="text-[var(--j-warning)]" />;
      case 'needs_review':
        return <ClipboardCheck size={14} className="text-[var(--j-primary)]" />;
      case 'blocked':
        return <Ban size={14} className="text-[var(--j-error)]" />;
      case 'cancelled':
        return <XCircle size={14} className="text-[var(--j-text-muted)]" />;
      default:
        return <AlertCircle size={14} className="text-[var(--j-text-muted)]" />;
    }
  };

  const getPriorityClass = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'bg-[rgba(255,51,102,0.2)] text-[var(--j-error)]';
      case 'medium':
        return 'bg-[rgba(255,184,0,0.2)] text-[var(--j-warning)]';
      default:
        return 'bg-[rgba(0,240,255,0.2)] text-[var(--j-primary)]';
    }
  };

  return (
    <div className="hud-panel flex-1" data-hue="purple">
      <div className="hud-panel-corner tl" />
      <div className="hud-panel-corner tr" />
      <div className="hud-panel-corner bl" />
      <div className="hud-panel-corner br" />

      <div className="hud-panel-header">
        <span className="icon-badge"><ListTodo size={15} /></span>
        <span>Active Tasks</span>
        <span className="hud-panel-tagline">What Kiaros is doing for you.</span>
      </div>

      <div className="hud-panel-content">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--j-text-muted)]">
            Loading...
          </div>
        ) : degraded ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--j-text-muted)]">
            <AlertCircle size={24} className="mb-2 opacity-50" />
            <span className="text-sm">Mission Control unreachable</span>
            <span className="text-xs opacity-70 mt-1">Tasks will appear when it recovers</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--j-text-muted)]">
            <div className="empty-constellation" aria-hidden="true">
              <i /><i /><i /><i /><i />
            </div>
            <span className="text-sm">Queue clear — standing by</span>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                className={`task-card priority-${task.priority} p-3 pl-4 bg-[rgba(255,255,255,0.03)] rounded border border-[var(--j-bg-panel-border)]`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(task.status)}
                    <span className="text-sm text-[var(--j-text-primary)] truncate">
                      {task.title}
                    </span>
                  </div>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${getPriorityClass(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>

                {task.status === 'needs_review' && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[rgba(0,240,255,0.15)] text-[var(--j-primary)]">
                      Needs your review
                    </span>
                    {approvingId === task.id ? (
                      <form
                        className="flex items-center gap-1.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitApprove(task.id);
                        }}
                      >
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          autoFocus
                          value={execCode}
                          onChange={(event) => setExecCode(event.target.value)}
                          placeholder="Execute code"
                          className="w-24 px-2 py-0.5 text-xs rounded bg-[rgba(255,255,255,0.06)] border border-[var(--j-bg-panel-border)] text-[var(--j-text-primary)] placeholder:text-[var(--j-text-muted)] focus:outline-none focus:border-[var(--j-primary)]"
                        />
                        <button
                          type="submit"
                          disabled={approveBusy || !execCode.trim()}
                          className="text-[10px] uppercase px-2 py-0.5 rounded bg-[rgba(0,240,255,0.2)] text-[var(--j-primary)] disabled:opacity-40 hover:bg-[rgba(0,240,255,0.3)] transition-colors"
                        >
                          {approveBusy ? '...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setApprovingId(null)}
                          className="text-[10px] uppercase px-1.5 py-0.5 text-[var(--j-text-muted)] hover:text-[var(--j-text-primary)] transition-colors"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => openApprove(task.id)}
                        className="text-[10px] uppercase px-2 py-0.5 rounded border border-[var(--j-primary)] text-[var(--j-primary)] hover:bg-[rgba(0,240,255,0.15)] transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {approvingId === task.id && approveError && (
                      <span className="text-[10px] text-[var(--j-error)] basis-full">{approveError}</span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--j-bg-panel-border)]">
          <div className="flex justify-between items-center text-xs text-[var(--j-text-muted)]">
            <span className="metric-number">Total: {tasks.length}</span>
            <motion.button
              onClick={fetchTasks}
              className="flex items-center gap-1.5 text-[var(--j-primary)] hover:text-[var(--j-text-primary)] transition-colors"
              whileTap={{ rotate: 180, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              title="Refresh tasks"
            >
              <RefreshCw size={12} />
              Refresh
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
