// server/utils/queue-simple.ts
// In-memory queue for simple job processing
export class SimpleQueue {
  private queue: any[] = [];
  private processing = false;
  private maxSize = 100;
  
  async add(job: any) {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Queue is full');
    }
    
    this.queue.push({
      id: Date.now().toString(),
      data: job,
      createdAt: new Date()
    });
    
    // Process if not already processing
    if (!this.processing) {
      this.process();
    }
  }
  
  private async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      
      try {
        // Process job
        if (job.data.type === 'process_lead') {
          const { processLead } = await import('../agents-lazy');
          await processLead(job.data.lead);
        }
      } catch (error) {
        console.error('Job processing error:', error);
      }
      
      // Small delay between jobs
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
  }
  
  getStats() {
    return {
      waiting: this.queue.length,
      processing: this.processing
    };
  }
}

export const jobQueue = new SimpleQueue();
