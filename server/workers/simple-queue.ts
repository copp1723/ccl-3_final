// Simple in-memory queue for basic job processing
import { logger } from '../utils/logger';

interface SimpleJob {
  id: string;
  type: string;
  data: any;
  createdAt: Date;
  retries: number;
}

class SimpleQueue {
  private jobs: SimpleJob[] = [];
  private processing = false;
  private maxRetries = 3;

  // Add a job to the queue
  add(type: string, data: any): string {
    const job: SimpleJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      createdAt: new Date(),
      retries: 0
    };

    this.jobs.push(job);
    this.processNext();
    return job.id;
  }

  // Process the next job in the queue
  private async processNext(): Promise<void> {
    if (this.processing || this.jobs.length === 0) {
      return;
    }

    this.processing = true;
    const job = this.jobs.shift();

    if (!job) {
      this.processing = false;
      return;
    }

    try {
      await this.processJob(job);
    } catch (error) {
      logger.error(`Job ${job.id} failed:`, error);
      
      // Retry logic
      if (job.retries < this.maxRetries) {
        job.retries++;
        this.jobs.push(job);
      } else {
        logger.error(`Job ${job.id} failed after ${this.maxRetries} retries`);
      }
    }

    this.processing = false;
    
    // Process next job
    if (this.jobs.length > 0) {
      setTimeout(() => this.processNext(), 100);
    }
  }

  // Process a specific job based on its type
  private async processJob(job: SimpleJob): Promise<void> {
    switch (job.type) {
      case 'email':
        await this.processEmailJob(job);
        break;
      case 'lead-update':
        await this.processLeadUpdateJob(job);
        break;
      default:
        logger.warn(`Unknown job type: ${job.type}`);
    }
  }

  // Process email jobs
  private async processEmailJob(job: SimpleJob): Promise<void> {
    // Simple email processing logic
    logger.info(`Processing email job ${job.id}`);
    // Add actual email processing logic here
  }

  // Process lead update jobs
  private async processLeadUpdateJob(job: SimpleJob): Promise<void> {
    // Simple lead update logic
    logger.info(`Processing lead update job ${job.id}`);
    // Add actual lead update logic here
  }

  // Get queue status
  getStatus() {
    return {
      pending: this.jobs.length,
      processing: this.processing
    };
  }
}

export const simpleQueue = new SimpleQueue();
