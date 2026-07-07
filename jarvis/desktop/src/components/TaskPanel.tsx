import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, ListTodo } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:3010/api/v1/tasks');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
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
      default:
        return <AlertCircle size={14} className="text-[var(--j-text-muted)]" />;
    }
  };

  const getPriorityClass = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-[rgba(255,51,102,0.2)] text-[var(--j-error)]';
      case 'medium':
        return 'bg-[rgba(255,184,0,0.2)] text-[var(--j-warning)]';
      default:
        return 'bg-[rgba(0,240,255,0.2)] text-[var(--j-primary)]';
    }
  };

  return (
    <div className="hud-panel flex-1">
      <div className="hud-panel-corner tl" />
      <div className="hud-panel-corner tr" />
      <div className="hud-panel-corner bl" />
      <div className="hud-panel-corner br" />
      
      <div className="hud-panel-header">
        <ListTodo size={16} />
        <span>Active Tasks</span>
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
            <ListTodo size={24} className="mb-2 opacity-50" />
            <span className="text-sm">No active tasks</span>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-[rgba(255,255,255,0.03)] rounded border border-[var(--j-bg-panel-border)] hover:border-[var(--j-hud-line)] transition-colors"
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
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--j-bg-panel-border)]">
          <div className="flex justify-between text-xs text-[var(--j-text-muted)]">
            <span>Total: {tasks.length}</span>
            <button 
              onClick={fetchTasks}
              className="text-[var(--j-primary)] hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
