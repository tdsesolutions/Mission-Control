/**
 * Jarvis Core Service
 * Main entry point for Jarvis AI Executive
 * Port: 3010
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { logger } from './utils/logger.js';
import { config, port, corsOrigins } from './config/index.js';
import { healthRouter } from './api/routes/health.js';
import { statusRouter } from './api/routes/status.js';
import { modeRouter } from './api/routes/mode.js';
import { conversationRouter } from './api/routes/conversation.js';
import { tasksRouter } from './api/routes/tasks.js';
import { projectsRouter } from './api/routes/projects.js';
import { memoryRouter } from './api/routes/memory.js';
import { eventsRouter } from './api/routes/events.js';
import { approvalRouter } from './api/routes/approval.js';
import { getApprovalEngine } from './services/approval/ApprovalEngine.js';
import { createAuthMiddleware } from './api/middleware/auth.js';
import { JarvisStateManager, setStateManager } from './services/stateManager.js';
import { MemoryService, getMemoryService } from './services/memoryService.js';
import { MissionControlClient, getMissionControlClient } from './services/missionControlClient.js';
import { MonitorService, setMonitorService } from './services/monitorService.js';
import { WebSocketManager } from './services/webSocketManager.js';
import { EventBus } from './services/eventBus.js';

// Environment variables are loaded by config/index.ts (imported above) —
// it must happen there because ES module imports are hoisted ahead of this
// module's body, and the config reads process.env at import time.

class JarvisCoreService {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private stateManager: JarvisStateManager;
  private memoryService: MemoryService;
  private missionControlClient: MissionControlClient;
  private monitorService: MonitorService;
  private wsManager: WebSocketManager;
  private eventBus: EventBus;
  private isShuttingDown = false;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    
    // Initialize services (WebSocketServer created in initialize())
    this.eventBus = new EventBus();
    this.stateManager = new JarvisStateManager(this.eventBus);
    setStateManager(this.stateManager);
    this.memoryService = getMemoryService();
    this.missionControlClient = getMissionControlClient();
    this.monitorService = new MonitorService(this.eventBus);
    setMonitorService(this.monitorService);
    getApprovalEngine().setEventBus(this.eventBus);
    this.wss = null as any;
    this.wsManager = null as any;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Jarvis Core Service...');
    logger.info(`Version: ${config.version}`);
    logger.info(`Environment: ${config.environment}`);

    // Setup middleware (must succeed for HTTP server to work)
    this.setupMiddleware();
    
    // Setup routes (must succeed for HTTP server to work)
    this.setupRoutes();
    
    // Setup WebSocket server (non-fatal)
    try {
      this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
      this.wsManager = new WebSocketManager(this.wss, this.eventBus);
    } catch (error) {
      logger.warn('WebSocket server failed to initialize:', error);
      this.wss = null as any;
      this.wsManager = null as any;
    }
    
    // Initialize services (non-fatal - each service has its own error handling)
    await this.initializeServices();
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
    
    logger.info('Jarvis Core Service initialized successfully');
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "ws:", "wss:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }));
    
    // CORS - handle both string and regex origins
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = corsOrigins;
        const isAllowed = allowedOrigins.some(allowed => {
          if (allowed instanceof RegExp) {
            return allowed.test(origin);
          }
          return allowed === origin;
        });
        
        if (isAllowed) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // API routes — /health stays open; /api/v1/* honors the optional
    // shared-secret (no-op when KIAROS_CORE_TOKEN is unset).
    this.app.use('/health', healthRouter);
    this.app.use('/api/v1', createAuthMiddleware(config.security.coreToken));
    this.app.use('/api/v1/status', statusRouter);
    this.app.use('/api/v1/mode', modeRouter);
    this.app.use('/api/v1/conversation', conversationRouter);
    this.app.use('/api/v1/tasks', tasksRouter);
    this.app.use('/api/v1/projects', projectsRouter);
    this.app.use('/api/v1/memory', memoryRouter);
    this.app.use('/api/v1/events', eventsRouter);
    this.app.use('/api/v1/approval', approvalRouter);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${req.method} ${req.path} not found`,
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown',
      });
    });

    // Error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred',
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'unknown',
      });
    });
  }

  private async initializeServices(): Promise<void> {
    // Initialize memory service
    try {
      await this.memoryService.initialize();
      logger.info('Memory service initialized');
    } catch (error) {
      logger.warn('Memory service failed to initialize:', error);
    }

    // Initialize Mission Control client
    try {
      await this.missionControlClient.initialize();
      logger.info('Mission Control client initialized');
    } catch (error) {
      logger.warn('Mission Control client failed to initialize:', error);
    }

    // Initialize monitor service
    try {
      await this.monitorService.initialize();
      logger.info('Monitor service initialized');
    } catch (error) {
      logger.warn('Monitor service failed to initialize:', error);
    }

    // Initialize WebSocket manager (if it was created)
    if (this.wsManager) {
      try {
        await this.wsManager.initialize();
        logger.info('WebSocket manager initialized');
      } catch (error) {
        logger.warn('WebSocket manager failed to initialize:', error);
      }
    }

    // Initialize state manager
    try {
      await this.stateManager.initialize();
      logger.info('State manager initialized');
    } catch (error) {
      logger.warn('State manager failed to initialize:', error);
    }

    // Inject service references
    this.stateManager.setServices({
      memoryService: this.memoryService,
      missionControlClient: this.missionControlClient,
      monitorService: this.monitorService,
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.info('Shutdown already in progress...');
        return;
      }
      
      this.isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close WebSocket connections (if created)
      if (this.wss) {
        this.wss.close(() => {
          logger.info('WebSocket server closed');
        });
      }

      // Shutdown services in reverse order (non-fatal)
      try {
        await this.stateManager.shutdown().catch(() => {});
        if (this.wsManager) {
          await this.wsManager.shutdown().catch(() => {});
        }
        await this.monitorService.shutdown().catch(() => {});
        await this.missionControlClient.shutdown().catch(() => {});
        await this.memoryService.shutdown().catch(() => {});
        
        logger.info('All services shutdown successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        logger.info(`Jarvis Core Service running on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`WebSocket: ws://localhost:${port}/ws`);
        resolve();
      });

      this.server.on('error', (error) => {
        logger.error('Server error:', error);
        reject(error);
      });
    });
  }
}

// Start the service
const service = new JarvisCoreService();

// Initialize and start - never exit on error, always try to start HTTP server
service.initialize()
  .then(() => service.start())
  .catch((error) => {
    logger.error('Initialization error (starting server anyway):', error);
    // Always attempt to start the server even if initialization had errors
    service.start().catch((startError) => {
      logger.error('Fatal: Server failed to start:', startError);
      process.exit(1);
    });
  });
