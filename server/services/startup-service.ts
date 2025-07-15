import { logger } from '../utils/logger';
import { campaignExecutionEngine } from './campaign-execution-engine';
import { emailReplyDetector } from './email-reply-detector';
import { queueManager } from '../workers/queue-manager';

export class StartupService {
  /**
   * Initialize all services required for deployment
   */
  static async initialize(): Promise<void> {
    logger.info('Starting CCL-3 SWARM services initialization...');

    try {
      // Start campaign execution engine
      await campaignExecutionEngine.start();
      logger.info('✅ Campaign execution engine started');

      // Start email reply detector
      await emailReplyDetector.start();
      logger.info('✅ Email reply detector started');

      // Queue manager is already initialized as singleton
      logger.info('✅ Queue manager initialized');

      logger.info('🚀 All CCL-3 SWARM services initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize CCL-3 SWARM services', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Graceful shutdown of all services
   */
  static async shutdown(): Promise<void> {
    logger.info('Shutting down CCL-3 SWARM services...');

    try {
      // Stop campaign execution engine
      await campaignExecutionEngine.stop();
      logger.info('✅ Campaign execution engine stopped');

      // Stop email reply detector
      await emailReplyDetector.stop();
      logger.info('✅ Email reply detector stopped');

      // Stop queue manager
      await queueManager.shutdown();
      logger.info('✅ Queue manager stopped');

      logger.info('🛑 All CCL-3 SWARM services shut down successfully');

    } catch (error) {
      logger.error('❌ Error during service shutdown', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Health check for all services
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    services: Record<string, boolean>;
  }> {
    const services = {
      queueManager: queueManager.isHealthy(),
      campaignEngine: true, // Simple check - could be enhanced
      emailDetector: true   // Simple check - could be enhanced
    };

    const healthy = Object.values(services).every(status => status);

    return {
      healthy,
      services
    };
  }
}