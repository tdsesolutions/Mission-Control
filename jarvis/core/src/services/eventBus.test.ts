import { describe, it, expect } from 'vitest';
import { EventBus, setEventBus, getEventBus } from './eventBus.js';

describe('EventBus', () => {
  it('emitEvent returns the recorded event', () => {
    const bus = new EventBus();
    const event = bus.emitEvent('error_occurred', 'warning', 'test-source', 'something happened', { detail: 1 });

    expect(event.id).toMatch(/^evt_/);
    expect(event.type).toBe('error_occurred');
    expect(event.severity).toBe('warning');
    expect(event.source).toBe('test-source');
    expect(event.message).toBe('something happened');
    expect(event.data).toEqual({ detail: 1 });
  });

  it('getEvents filters by type, severity, and limit', () => {
    const bus = new EventBus();
    bus.emitEvent('service_started', 'info', 'a', 'one');
    bus.emitEvent('service_stopped', 'warning', 'b', 'two');
    bus.emitEvent('service_started', 'info', 'c', 'three');

    expect(bus.getEvents({ type: 'service_started' })).toHaveLength(2);
    expect(bus.getEvents({ severity: 'warning' })).toHaveLength(1);
    expect(bus.getEvents({ limit: 1 })).toHaveLength(1);
    expect(bus.getEvents()).toHaveLength(3);
  });

  it('emitted events reach bus subscribers', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on('*', (event) => seen.push(event.message));
    bus.emitEvent('memory_updated', 'info', 'test', 'hello');

    expect(seen).toEqual(['hello']);
  });

  it('shares the registered instance with route modules', () => {
    const bus = new EventBus();
    setEventBus(bus);
    expect(getEventBus()).toBe(bus);
  });

  it('trims history beyond maxEvents', () => {
    const bus = new EventBus(5);
    for (let i = 0; i < 10; i++) {
      bus.emitEvent('memory_updated', 'info', 'test', `event ${i}`);
    }
    const events = bus.getEvents({ limit: 100 });
    expect(events).toHaveLength(5);
    expect(events.map((e) => e.message)).toContain('event 9');
    expect(events.map((e) => e.message)).not.toContain('event 0');
  });
});
