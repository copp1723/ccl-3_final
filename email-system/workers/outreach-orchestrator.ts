// Stub file for outreach orchestrator - implementation temporarily disabled
export const outreachOrchestrator = {
  initialize: async () => {},
  start: async () => {},
  stop: async () => {},
  processOutreachQueue: async () => ({ success: true, processed: 0, sent: 0, failed: 0, results: [], processingTime: 0 }),
  processOutreachNow: async () => ({ success: true, processed: 0, sent: 0, failed: 0, results: [], processingTime: 0 }),
  isCurrentlyRunning: () => false,
  getNextRunTime: () => null,
  healthCheck: async () => ({ healthy: true })
};