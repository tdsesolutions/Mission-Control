import { describe, it, expect, vi } from 'vitest';
import { createAuthMiddleware } from './auth.js';

function run(middleware: ReturnType<typeof createAuthMiddleware>, headers: Record<string, string>, method = 'GET') {
  const next = vi.fn();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  middleware(
    { method, headers } as never,
    { status } as never,
    next,
  );
  return { next, status, json };
}

describe('Core API auth middleware (defect 5)', () => {
  it('is a no-op when no token is configured (default open-on-localhost behavior)', () => {
    const { next, status } = run(createAuthMiddleware(''), {});
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('rejects missing token when configured', () => {
    const { next, status } = run(createAuthMiddleware('secret'), {});
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('accepts Authorization: Bearer', () => {
    const { next } = run(createAuthMiddleware('secret'), { authorization: 'Bearer secret' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('accepts x-kiaros-token', () => {
    const { next } = run(createAuthMiddleware('secret'), { 'x-kiaros-token': 'secret' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a wrong token', () => {
    const { next, status } = run(createAuthMiddleware('secret'), { 'x-kiaros-token': 'wrong' });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });

  it('lets CORS preflight through', () => {
    const { next } = run(createAuthMiddleware('secret'), {}, 'OPTIONS');
    expect(next).toHaveBeenCalledOnce();
  });
});
