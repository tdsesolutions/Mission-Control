/**
 * Core API auth middleware (CURRENT_PHASE defect 5).
 *
 * Optional shared-secret model appropriate for a localhost-bound personal
 * service: when KIAROS_CORE_TOKEN is unset (default), behavior is unchanged
 * (open on localhost). When set, every /api/v1/* request must present the
 * token via `Authorization: Bearer <token>` or `x-kiaros-token`.
 * /health always stays open so monitors keep working.
 */

import type { Request, Response, NextFunction } from 'express';

export function createAuthMiddleware(expectedToken: string) {
  return function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!expectedToken) {
      next();
      return;
    }
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const header = req.headers['authorization'];
    const bearer = typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
      ? header.slice(7).trim()
      : '';
    const direct = typeof req.headers['x-kiaros-token'] === 'string'
      ? (req.headers['x-kiaros-token'] as string).trim()
      : '';

    if (bearer === expectedToken || direct === expectedToken) {
      next();
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'This Kiaros Core requires a token (KIAROS_CORE_TOKEN). Send it as Authorization: Bearer or x-kiaros-token.',
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
  };
}
