/**
 * HUD mode — full-screen system overview. Every number on this screen is
 * live from Kiaros Core (/api/v1/status + /api/v1/status/services); the
 * former hardcoded values were an Art. IV honesty violation, removed
 * 2026-07-09.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Server, Cpu, HardDrive, Wifi, Shield } from 'lucide-react';
import { useJarvisStore } from '../stores/jarvisStore';
import { coreHeaders } from '../services/coreAuth';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  port: number;
}

interface CoreStatus {
  version: string;
  uptime: number;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    requestCount: number;
    errorRate: number;
    latency: number;
  };
}

const POLL_MS = 5_000;

function formatUptime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

const SERVICE_LABELS: Record<string, string> = {
  'openclaw-gateway': 'OpenClaw Gateway',
  'mission-control': 'Mission Control',
  'jarvis-core': 'Kiaros Core',
};

export function JarvisHUD() {
  const { isConnected } = useJarvisStore();
  const [core, setCore] = useState<CoreStatus | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const [statusRes, servicesRes] = await Promise.all([
          fetch('http://localhost:3010/api/v1/status', { headers: coreHeaders() }),
          fetch('http://localhost:3010/api/v1/status/services', { headers: coreHeaders() }),
        ]);
        if (cancelled) return;
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.success && data.data) {
            setCore({ version: data.data.version, uptime: data.data.uptime, metrics: data.data.metrics });
          }
        }
        if (servicesRes.ok) {
          const data = await servicesRes.json();
          if (data.success && Array.isArray(data.data)) {
            setServices(data.data);
          }
        }
      } catch {
        if (!cancelled) {
          setCore(null);
          setServices([]);
        }
      }
    };

    fetchAll();
    const timer = setInterval(fetchAll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const allHealthy = isConnected && services.length > 0 && services.every((service) => service.status === 'healthy');
  const errorRate = core?.metrics.errorRate ?? 0;

  return (
    <div className="jarvis-hud-full">
      {/* System Overview */}
      <div className="hud-section">
        <div className="hud-section-title">
          <Activity size={14} />
          System Overview
        </div>
        <div className="space-y-2">
          <MetricRow label="Status" value={isConnected ? 'ONLINE' : 'OFFLINE'} type={isConnected ? 'success' : 'error'} />
          <MetricRow label="Version" value={core ? `v${core.version}` : '—'} />
          <MetricRow label="Uptime" value={core ? formatUptime(core.uptime) : '—'} />
          <MetricRow
            label="Load"
            value={core ? `${core.metrics.cpuUsage.toFixed(0)}%` : '—'}
            type={core && core.metrics.cpuUsage < 80 ? 'success' : 'warning'}
          />
        </div>
      </div>

      {/* Center - KIAROS Logo */}
      <div className="hud-section flex flex-col items-center justify-center text-center">
        <div className="text-7xl font-bold tracking-wider mb-4" style={{
          background: 'linear-gradient(135deg, var(--j-primary), var(--j-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 60px var(--j-primary-glow)',
        }}>
          KIAROS
        </div>
        <div className="text-[var(--j-text-secondary)] text-lg tracking-[0.3em] uppercase">
          AI Executive System
        </div>
        <div className="mt-8 flex items-center gap-4">
          <div className="px-4 py-2 bg-[rgba(0,240,255,0.1)] border border-[var(--j-primary-dim)] rounded text-[var(--j-primary)] text-sm">
            {isConnected ? 'READY' : 'CORE OFFLINE'}
          </div>
          {allHealthy ? (
            <div className="px-4 py-2 bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.3)] rounded text-[var(--j-success)] text-sm">
              ALL SYSTEMS OPERATIONAL
            </div>
          ) : (
            <div className="px-4 py-2 bg-[rgba(255,184,0,0.1)] border border-[rgba(255,184,0,0.3)] rounded text-[var(--j-warning)] text-sm">
              {isConnected ? 'DEGRADED — SEE SERVICES' : 'NO TELEMETRY'}
            </div>
          )}
        </div>
      </div>

      {/* Services (live from Core's MonitorService) */}
      <div className="hud-section">
        <div className="hud-section-title">
          <Server size={14} />
          Services
        </div>
        <div className="space-y-2">
          {services.length === 0 ? (
            <div className="text-sm text-[var(--j-text-muted)]">No telemetry — Kiaros Core unreachable</div>
          ) : (
            services.map((service) => (
              <ServiceRow
                key={service.name}
                name={SERVICE_LABELS[service.name] ?? service.name}
                port={service.port}
                healthy={service.status === 'healthy'}
              />
            ))
          )}
        </div>
      </div>

      {/* Metrics (live CoreMetrics) */}
      <div className="hud-section col-span-3">
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            icon={<Cpu size={20} />}
            label="Core CPU"
            value={core ? `${core.metrics.cpuUsage.toFixed(0)}%` : '—'}
            subtext="of one core"
          />
          <MetricCard
            icon={<HardDrive size={20} />}
            label="Core Memory"
            value={core ? `${core.metrics.memoryUsage} MB` : '—'}
            subtext="resident set"
          />
          <MetricCard
            icon={<Wifi size={20} />}
            label="Latency"
            value={core ? `${core.metrics.latency.toFixed(1)} ms` : '—'}
            subtext={core ? `${core.metrics.requestCount} requests` : 'no data'}
          />
          <MetricCard
            icon={<Shield size={20} />}
            label="Error Rate"
            value={core ? `${errorRate.toFixed(1)}%` : '—'}
            subtext="of Core requests"
            type={core && errorRate === 0 ? 'success' : 'neutral'}
          />
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, type = 'neutral' }: { label: string; value: string; type?: 'success' | 'error' | 'warning' | 'neutral' }) {
  const colors = {
    success: 'text-[var(--j-success)]',
    error: 'text-[var(--j-error)]',
    warning: 'text-[var(--j-warning)]',
    neutral: 'text-[var(--j-text-primary)]',
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-[var(--j-text-secondary)]">{label}</span>
      <span className={`text-sm font-mono ${colors[type]}`}>{value}</span>
    </div>
  );
}

function ServiceRow({ name, port, healthy }: { name: string; port: number; healthy: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-sm text-[var(--j-text-primary)]">{name}</div>
        <div className="text-xs text-[var(--j-text-muted)]">:{port}</div>
      </div>
      <div className={`w-2 h-2 rounded-full ${healthy ? 'bg-[var(--j-success)] shadow-[0_0_8px_var(--j-success)]' : 'bg-[var(--j-error)]'}`} />
    </div>
  );
}

function MetricCard({ icon, label, value, subtext, type = 'neutral' }: {
  icon: ReactNode;
  label: string;
  value: string;
  subtext: string;
  type?: 'success' | 'neutral';
}) {
  return (
    <div className="metric-card flex items-center gap-4 p-4">
      <div className={`${type === 'success' ? 'text-[var(--j-success)]' : 'text-[var(--j-primary)]'}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-[var(--j-text-muted)] uppercase tracking-wider">{label}</div>
        <div className={`text-2xl font-mono font-semibold ${type === 'success' ? 'text-[var(--j-success)]' : 'text-[var(--j-text-primary)]'}`}>
          {value}
        </div>
        <div className="text-xs text-[var(--j-text-muted)]">{subtext}</div>
      </div>
    </div>
  );
}
