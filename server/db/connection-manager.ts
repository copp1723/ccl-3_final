import { logger } from '../utils/logger';

export interface DatabaseStatus {
  connected: boolean;
  lastError?: string;
  lastCheckTime: Date;
  connectionAttempts: number;
}

class DatabaseConnectionManager {
  private status: DatabaseStatus = {
    connected: false,
    lastCheckTime: new Date(),
    connectionAttempts: 0
  };

  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  constructor() {
    this.startHealthCheck();
  }

  /**
   * Check if database is available
   */
  async checkConnection(): Promise<boolean> {
    if (this.isChecking) {
      return this.status.connected;
    }

    this.isChecking = true;
    this.status.connectionAttempts++;

    try {
      // Try to import and use the database client
      const { db } = await import('./client');
      
      // Simple query to test connection
      await db.execute`SELECT 1`;
      
      this.status.connected = true;
      this.status.lastError = undefined;
      logger.info('Database connection successful');
      return true;
    } catch (error) {
      this.status.connected = false;
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      if (this.status.connectionAttempts === 1) {
        logger.warn('Database connection failed, falling back to mock data mode', {
          error: this.status.lastError,
          hint: 'Application will continue with sample data'
        });
      }
      
      return false;
    } finally {
      this.status.lastCheckTime = new Date();
      this.isChecking = false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    // Initial check
    this.checkConnection();

    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      if (!this.status.connected) {
        this.checkConnection();
      }
    }, 30000);
  }

  /**
   * Stop health checks
   */
  stopHealthCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): DatabaseStatus {
    return { ...this.status };
  }

  /**
   * Check if database is available (sync)
   */
  isConnected(): boolean {
    return this.status.connected;
  }

  /**
   * Execute a database operation with fallback
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    if (this.status.connected) {
      try {
        return await operation();
      } catch (error) {
        logger.error('Database operation failed, using fallback', { error });
        this.status.connected = false;
        this.status.lastError = error instanceof Error ? error.message : 'Operation failed';
      }
    }

    // Use fallback
    return await fallback();
  }
}

// Singleton instance
export const dbConnectionManager = new DatabaseConnectionManager();

// Graceful shutdown
process.on('SIGTERM', () => {
  dbConnectionManager.stopHealthCheck();
});

process.on('SIGINT', () => {
  dbConnectionManager.stopHealthCheck();
});