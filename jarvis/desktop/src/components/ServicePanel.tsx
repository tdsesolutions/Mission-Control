import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { coreHeaders } from '../services/coreAuth';
import { Server, Activity, Cpu } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'warning';
  port: number;
  latency?: number;
}

/** Real process metrics reported by Kiaros Core (units per CoreMetrics). */
interface CoreMetrics {
  cpuUsage: number;
  memoryUsage: number;
}

const JARVIS_CORE_URL = 'http://localhost:3010';
/** ~2 minutes of 5s polls — the sparkline window. */
const HISTORY_LENGTH = 24;

/** Tiny real-data sparkline; renders nothing until 2+ samples exist. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * 72;
      const y = 18 - ((value - min) / range) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg className="sparkline" width="72" height="20" viewBox="0 0 72 20">
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function ServicePanel() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'OpenClaw Gateway', status: 'offline', port: 18789 },
    { name: 'Mission Control', status: 'offline', port: 3002 },
    { name: 'Kiaros Core', status: 'offline', port: 3010 },
  ]);
  const [coreMetrics, setCoreMetrics] = useState<CoreMetrics | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);

  useEffect(() => {
    // Ecosystem health comes from Kiaros Core's MonitorService only. The
    // Desktop never fetches Mission Control or the OpenClaw Gateway directly
    // (MESSAGE_ROUTING.md §7, COMPONENT_OWNERSHIP.md §1).
    const DISPLAY_NAMES: Record<string, string> = {
      'openclaw-gateway': 'OpenClaw Gateway',
      'mission-control': 'Mission Control',
      'jarvis-core': 'Kiaros Core',
    };
    const toDisplayStatus = (status: string): ServiceStatus['status'] =>
      status === 'healthy' ? 'online' : status === 'unknown' ? 'warning' : 'offline';

    const checkServices = async () => {
      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${JARVIS_CORE_URL}/api/v1/status/services`, {
          method: 'GET',
          headers: coreHeaders(),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - start;

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const monitored: Array<{ name: string; status: string; port: number; metrics?: CoreMetrics }> =
          Array.isArray(payload?.data) ? payload.data : [];

        // Real process metrics ride on the jarvis-core entry; no reading
        // means no numbers — never fabricate.
        const coreEntry = monitored.find((m) => m.name === 'jarvis-core');
        const metrics = coreEntry?.metrics ?? null;
        setCoreMetrics(metrics);
        if (metrics) {
          setCpuHistory((h) => [...h, metrics.cpuUsage].slice(-HISTORY_LENGTH));
          setMemHistory((h) => [...h, metrics.memoryUsage].slice(-HISTORY_LENGTH));
        }

        setServices((current) =>
          current.map((service) => {
            const match = monitored.find((m) => m.port === service.port);
            if (!match) return { ...service, status: 'warning' as const, latency: undefined };
            return {
              ...service,
              name: DISPLAY_NAMES[match.name] ?? service.name,
              status: toDisplayStatus(match.status),
              latency: service.port === 3010 ? latency : undefined,
            };
          })
        );
      } catch {
        // Core unreachable: nothing is knowable from the Desktop
        setServices((current) =>
          current.map((service) => ({ ...service, status: 'offline' as const, latency: undefined }))
        );
        setCoreMetrics(null);
      }
    };

    // Check immediately
    checkServices();

    // Then check periodically
    const interval = setInterval(checkServices, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hud-panel flex-1">
      <div className="hud-panel-corner tl" />
      <div className="hud-panel-corner tr" />
      <div className="hud-panel-corner bl" />
      <div className="hud-panel-corner br" />

      <div className="hud-panel-header">
        <span className="icon-badge"><Server size={15} /></span>
        <span>System Services</span>
        <span className="hud-panel-tagline">Every system, one heartbeat.</span>
      </div>

      <div className="hud-panel-content">
        <div className="space-y-1">
          {services.map((service, index) => (
            <motion.div
              key={service.name}
              className="service-row flex items-center justify-between py-2 border-b border-[var(--j-bg-panel-border)] last:border-0"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.09, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div>
                <div className="text-sm text-[var(--j-text-primary)]">{service.name}</div>
                <div className="text-xs text-[var(--j-text-muted)]">Port {service.port}</div>
              </div>
              <div className="flex items-center gap-2">
                {service.latency !== undefined && service.status === 'online' && (
                  <span className="text-xs text-[var(--j-text-muted)] font-mono metric-number">
                    {service.latency}ms
                  </span>
                )}
                <div className={`status-dot ${service.status}`} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--j-bg-panel-border)]">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={<Activity size={14} />}
              label="Core CPU"
              value={coreMetrics ? `${coreMetrics.cpuUsage}%` : '—'}
              history={cpuHistory}
              color="var(--j-primary)"
            />
            <MetricCard
              icon={<Cpu size={14} />}
              label="Core Memory"
              value={coreMetrics ? `${coreMetrics.memoryUsage}MB` : '—'}
              history={memHistory}
              color="var(--j-secondary)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, history, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  history: number[];
  color: string;
}) {
  return (
    <div className="bg-[rgba(255,255,255,0.03)] rounded p-3">
      <div className="flex items-center gap-2 text-[var(--j-text-muted)] text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      {/* Key on value: each reading pops in — live, not static */}
      <motion.div
        key={value}
        className="text-lg metric-number text-[var(--j-primary)]"
        initial={{ opacity: 0.4, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {value}
      </motion.div>
      <Sparkline points={history} color={color} />
    </div>
  );
}
