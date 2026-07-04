/**
 * Jarvis Logger
 * Winston-based logging utility
 */

import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create logs directory path
const logsDir = join(process.cwd(), 'logs');

// Ensure logs directory exists (wrapped in try-catch to prevent startup failure)
try {
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  // Fallback: log to console only if directory creation fails
  console.warn('Failed to create logs directory, logging to console only:', error);
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'jarvis-core' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: join(logsDir, 'jarvis.log'),
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
    }),
    
    // File transport for errors only
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: join(logsDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: join(logsDir, 'rejections.log') }),
  ],
});

// Create a child logger with additional context
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}
