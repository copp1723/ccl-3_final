import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import session from 'express-session';
import MemoryStore from 'memorystore';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { productionConfig } from './config/production.js';
import { registerRoutes } from './routes';
import { healthHandler, authHandler, agentHandler, leadHandler } from './api';
import { closeConnection } from './db';
import { globalErrorHandler, notFoundHandler } from './utils/error-handler.js';
import { requestTimeout } from './middleware/error-handler';
import { sanitizeRequest } from './middleware/validation';
import { feedbackService } from './services/feedback-service';
import { LeadProcessor } from './services/lead-processor';
import { WebSocketMessageHandler } from './websocket/message-handler';
import { logger } from './utils/logger.js';
import { initializeRedis, closeRedisConnections, sessionRedis } from './utils/redis.js';
import { ipRateLimit, addRateLimitInfo } from './middleware/rate-limit.js';
import { queueManager } from './workers/queue-manager.js';
import { performanceMonitor } from './utils/performance-monitor.js';
import { metricsCollector } from './utils/metrics.js';
import { healthChecker } from './utils/health-checker.js';
import { register } from 'prom-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize Redis and database connections
await initializeRedis();

// Initialize queue system (depends on Redis)
logger.info('Initializing queue system...');

// Initialize monitoring systems (conditional for production)
const config = process.env.NODE_ENV === 'production' ? productionConfig : { features: { enableHealthChecks: true, enableMetrics: true, enablePerformanceMonitoring: true } };

if (config.features.enableHealthChecks || config.features.enableMetrics) {
  logger.info('Initializing monitoring systems...');
  try {
    // Performance monitor and health checker initialize themselves
    if (performanceMonitor.isReady() && healthChecker.isReady() && metricsCollector.isReady()) {
      logger.info('Monitoring systems initialized successfully', {
        components: ['performance-monitor', 'health-checker', 'metrics-collector']
      });
      logger.info('Monitoring systems initialized successfully', {
        components: ['performance-monitor', 'health-checker', 'metrics-collector'],
        level: 'info'
      });
    } else {
      logger.warn('Some monitoring components not ready at startup');
    }
  } catch (error) {
    logger.error('Failed to initialize monitoring systems', {
      error: (error as Error).message
    });
  }
} else {
  logger.info('Monitoring systems disabled in production to save memory');
}

// Session store
const MemoryStoreSession = MemoryStore(session);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeRequest);
app.use(requestTimeout(30000)); // 30 second timeout

// Prometheus metrics middleware for HTTP requests
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record HTTP metrics
    metricsCollector.getRegistry().getSingleMetric('ccl3_http_requests_total')?.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
      user_tier: req.user?.tier || 'anonymous'
    });
    
    metricsCollector.getRegistry().getSingleMetric('ccl3_http_request_duration_seconds')?.observe({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString()
    }, duration);
  });
  
  next();
});

// Rate limiting and protection middleware
app.use(addRateLimitInfo); // Add rate limit info to responses
app.use(ipRateLimit); // Basic IP-based rate limiting

// Register all application routes
registerRoutes(app);

// Session configuration
const sessionConfig: any = {
  secret: process.env.SESSION_SECRET || 'ccl3-swarm-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: process.env.NODE_ENV === 'production' ? 86400000 : 7 * 24 * 60 * 60 * 1000 // 1 day in prod, 7 days in dev
  }
};

// Use Redis for sessions in production if available
if (process.env.NODE_ENV === 'production' && sessionRedis) {
  const RedisStore = require('connect-redis').default;
  sessionConfig.store = new RedisStore({
    client: sessionRedis,
    prefix: 'ccl3:sess:',
  });
  logger.info('Using Redis for session storage');
} else {
  sessionConfig.store = new MemoryStoreSession({
    checkPeriod: 3600000, // 1 hour
    max: 1000, // Maximum 1000 sessions in memory
    ttl: 86400000, // 1 day
  });
  logger.info('Using MemoryStore for session storage');
}

app.use(session(sessionConfig));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      // Simple auth for now - replace with proper user management
      if (username === 'admin' && password === 'admin') {
        return done(null, { id: 1, username: 'admin' });
      }
      return done(null, false, { message: 'Invalid credentials' });
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  // Simple deserialize for now
  if (id === 1) {
    done(null, { id: 1, username: 'admin' });
  } else {
    done(new Error('User not found'));
  }
});

// Helper function to broadcast to all WebSocket clients
function broadcastToClients(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// Initialize lead processor with broadcast callback
const leadProcessor = new LeadProcessor(broadcastToClients);

// Initialize feedback service with WebSocket server
feedbackService.initialize(wss);

// Initialize WebSocket message handler
const wsMessageHandler = new WebSocketMessageHandler(wss, leadProcessor, broadcastToClients);

// WebSocket handling for real-time updates
wss.on('connection', (ws, req) => {
  wsMessageHandler.setupConnection(ws, req);
});

// Health check
app.get('/api/health', healthHandler.check);

// Auth routes
app.post('/api/auth/login', authHandler.login);
app.post('/api/auth/logout', authHandler.logout);
app.get('/api/auth/me', authHandler.me);

// Agent routes
app.get('/api/agents', agentHandler.getAgents);

// Lead routes
app.get('/api/leads', leadHandler.getLeads);
app.post('/api/leads', leadHandler.createLead(leadProcessor, broadcastToClients));
app.get('/api/leads/stats/summary', leadHandler.getLeadStats);
app.get('/api/leads/:leadId', leadHandler.getLead);
app.patch('/api/leads/:leadId/status', leadHandler.updateLeadStatus(broadcastToClients));

// Conversation routes
app.get('/api/conversations/:leadId', leadHandler.getLeadConversations);

// Serve static files - adjust path based on environment
const staticPath = process.env.NODE_ENV === 'production' 
  ? join(__dirname, './client')  // In production, client files are in dist/client
  : join(__dirname, '../client/dist'); // In development, use original structure

app.use(express.static(staticPath));

// Serve chat widget files from public directory
const publicPath = process.env.NODE_ENV === 'production'
  ? join(__dirname, './client')  // In production, public files are copied to dist/client
  : join(__dirname, '../client/public');

app.use('/chat-widget-embed.js', express.static(join(publicPath, 'chat-widget-embed.js')));
app.use('/chat-demo.html', express.static(join(publicPath, 'chat-demo.html')));

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve the React app
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info('CCL-3 SWARM server started successfully', { port: PORT, agents: ['Overlord', 'Email', 'SMS', 'Chat'] });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    try {
      // Shutdown monitoring systems
      logger.info('Shutting down monitoring systems...');
      await performanceMonitor.shutdown();
      
      // Shutdown other systems
      await queueManager.shutdown();
      await closeConnection();
      await closeRedisConnections();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: (error as Error).message });
      process.exit(1);
    }
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(async () => {
    try {
      await performanceMonitor.shutdown();
      await queueManager.shutdown();
      await closeConnection();
      await closeRedisConnections();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: (error as Error).message });
      process.exit(1);
    }
  });
});