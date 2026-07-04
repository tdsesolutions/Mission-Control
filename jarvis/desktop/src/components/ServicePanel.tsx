import { useEffect, useState } from 'react';
import { Server, Activity, Cpu } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'warning';
  port: number;
  latency?: number;
}

const JARVIS_CORE_URL = 'http://localhost:3010';

export function ServicePanel() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'OpenClaw Gateway', status: 'offline', port: 18789 },
    { name: 'Mission Control', status: 'offline', port: 3002 },
    { name: 'Kiaros Core', status: 'offline', port: 3010 },
  ]);

  useEffect(() => {
    // Check service health periodically
    const checkServices = async () => {
      const updated = await Promise.all(
        services.map(async (service) => {
          try {
            const start = Date.now();
            // Use the appropriate URL for each service
            let url: string;
            if (service.port === 3010) {
              url = `${JARVIS_CORE_URL}/health`;
            } else if (service.port === 3002) {
              url = `http://localhost:3002/api/health`;
            } else {
              url = `http://localhost:${service.port}/health`;
            }
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(url, {
              method: 'GET',
              signal: controller.signal,
            });
            clearTimeout(timeout);
            const latency = Date.now() - start;
            return {
              ...service,
              status: response.ok ? ('online' as const) : ('warning' as const),
              latency,
            };
          } catch {
            return { ...service, status: 'offline' as const, latency: undefined };
          }
        })
      );
      setServices(updated);
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
        <Server size={16} />
        <span>System Services</span>
      </div>
      
      <div className="hud-panel-content">
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between py-2 border-b border-[var(--j-bg-panel-border)] last:border-0">
              <div>
                <div className="text-sm text-[var(--j-text-primary)]">{service.name}</div>
                <div className="text-xs text-[var(--j-text-muted)]">Port {service.port}</div>
              </div>
              <div className="flex items-center gap-2">
                {service.latency !== undefined && service.status === 'online' && (
                  <span className="text-xs text-[var(--j-text-muted)] font-mono">
                    {service.latency}ms
                  </span>
                )}
                <div className={`status-dot ${service.status}`} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-[var(--j-bg-panel-border)]">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={<Activity size={14} />} label="CPU" value="12%" />
            <MetricCard icon={<Cpu size={14} />} label="Memory" value="456MB" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[rgba(255,255,255,0.03)] rounded p-3">
      <div className="flex items-center gap-2 text-[var(--j-text-muted)] text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-mono text-[var(--j-primary)]">{value}</div>
    </div>
  );
}
