import { Activity, Server, Cpu, HardDrive, Wifi, Shield } from 'lucide-react';
import { useJarvisStore } from '../stores/jarvisStore';

export function JarvisHUD() {
  const { isConnected } = useJarvisStore();

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
          <MetricRow label="Version" value="v1.0.0" />
          <MetricRow label="Uptime" value="00:00:00" />
          <MetricRow label="Load" value="12%" type="success" />
        </div>
      </div>

      {/* Center - JARVIS Logo */}
      <div className="hud-section flex flex-col items-center justify-center text-center">
        <div className="text-7xl font-bold tracking-wider mb-4" style={{
          background: 'linear-gradient(135deg, var(--j-primary), var(--j-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 60px var(--j-primary-glow)',
        }}>
          JARVIS
        </div>
        <div className="text-[var(--j-text-secondary)] text-lg tracking-[0.3em] uppercase">
          AI Executive System
        </div>
        <div className="mt-8 flex items-center gap-4">
          <div className="px-4 py-2 bg-[rgba(0,240,255,0.1)] border border-[var(--j-primary-dim)] rounded text-[var(--j-primary)] text-sm">
            READY
          </div>
          <div className="px-4 py-2 bg-[rgba(0,255,136,0.1)] border border-[rgba(0,255,136,0.3)] rounded text-[var(--j-success)] text-sm">
            ALL SYSTEMS OPERATIONAL
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="hud-section">
        <div className="hud-section-title">
          <Server size={14} />
          Services
        </div>
        <div className="space-y-2">
          <ServiceRow name="OpenClaw Gateway" port={18789} status="online" />
          <ServiceRow name="Mission Control" port={3002} status="online" />
          <ServiceRow name="Jarvis Core" port={3010} status="online" />
          <ServiceRow name="Jarvis Desktop" port={3011} status="online" />
        </div>
      </div>

      {/* Metrics */}
      <div className="hud-section col-span-3">
        <div className="grid grid-cols-4 gap-4">
          <MetricCard icon={<Cpu size={20} />} label="CPU Usage" value="12%" subtext="4 cores active" />
          <MetricCard icon={<HardDrive size={20} />} label="Memory" value="456 MB" subtext="of 8 GB" />
          <MetricCard icon={<Wifi size={20} />} label="Network" value="1.2 ms" subtext="latency" />
          <MetricCard icon={<Shield size={20} />} label="Security" value="SECURE" subtext="All checks passed" type="success" />
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

function ServiceRow({ name, port, status }: { name: string; port: number; status: 'online' | 'offline' }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-sm text-[var(--j-text-primary)]">{name}</div>
        <div className="text-xs text-[var(--j-text-muted)]">:{port}</div>
      </div>
      <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-[var(--j-success)] shadow-[0_0_8px_var(--j-success)]' : 'bg-[var(--j-error)]'}`} />
    </div>
  );
}

function MetricCard({ icon, label, value, subtext, type = 'neutral' }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  subtext: string;
  type?: 'success' | 'neutral';
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-[rgba(255,255,255,0.03)] rounded-lg border border-[var(--j-bg-panel-border)]">
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
