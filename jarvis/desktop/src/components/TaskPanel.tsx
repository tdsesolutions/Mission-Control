import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { coreHeaders } from '../services/coreAuth';
import { useJarvisStore } from '../stores/jarvisStore';
import { CheckCircle2, Clock, AlertCircle, ListTodo, Ban, XCircle, RefreshCw } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
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

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={14} className="text-[var(--j-success)]" />;
      case 'in_progress':
        return <Clock size={14} className="text-[var(--j-warning)]" />;
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
