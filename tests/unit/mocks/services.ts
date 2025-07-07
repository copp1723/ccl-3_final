import { vi } from "vitest";

// Email service mock
export const createEmailServiceMock = () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-message-id" }),
  sendBulkEmails: vi.fn().mockResolvedValue({ success: true, sent: 1, failed: 0 }),
  validateEmail: vi.fn().mockReturnValue(true),
});

// Webhook service mock
export const createWebhookServiceMock = () => ({
  sendWebhook: vi.fn().mockResolvedValue({ success: true, response: { status: 200 } }),
  validateWebhookUrl: vi.fn().mockReturnValue(true),
});

// Boberdoo service mock
export const createBoberdooServiceMock = () => ({
  submitLead: vi.fn().mockResolvedValue({ 
    success: true, 
    leadId: "boberdoo-lead-123",
    response: { accepted: true }
  }),
  validateLeadData: vi.fn().mockReturnValue(true),
  formatLeadForSubmission: vi.fn().mockReturnValue({}),
});