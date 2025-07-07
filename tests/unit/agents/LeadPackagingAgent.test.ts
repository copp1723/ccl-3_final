import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest";
import { LeadPackagingAgent } from "@server/agents/LeadPackagingAgent";
import { storage } from "@server/storage";
import { WebhookService } from "@server/services/WebhookService";
import { boberdooService } from "@server/services/boberdoo-service";

const mockStorage = storage as any;
const mockBoberdooService = boberdooService as any;

describe("LeadPackagingAgent", () => {
  let agent: LeadPackagingAgent;
  let mockVisitor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new LeadPackagingAgent();
    
    mockVisitor = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      street: "123 Main St",
      city: "Anytown",
      state: "CA",
      zip: "12345",
      employer: "Test Corp",
      jobTitle: "Manager",
      annualIncome: 50000,
      timeOnJobMonths: 24,
      phoneNumber: "+15551234567",
      email: "john@example.com",
      emailHash: "hash123",
      creditCheckStatus: "approved",
    };
    
    // Setup default successful mocks
    mockStorage.getVisitor.mockResolvedValue(mockVisitor);
    mockStorage.getEmailCampaignsByVisitor.mockResolvedValue([]);
    mockStorage.getChatSessionsByVisitor.mockResolvedValue([]);
    mockStorage.createLead.mockResolvedValue({ id: "lead_123" });
    mockStorage.updateLead.mockResolvedValue({});
    mockStorage.createAgentActivity.mockResolvedValue({});
  });

  describe("PII Validation", () => {
    it("should validate complete PII successfully", async () => {
      mockStorage.getVisitor.mockResolvedValue(mockVisitor);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(mockStorage.getVisitor).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it("should reject incomplete PII", async () => {
      const incompleteVisitor = { ...mockVisitor, firstName: null };
      mockStorage.getVisitor.mockResolvedValue(incompleteVisitor);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Incomplete PII");
    });

    it("should handle missing visitor", async () => {
      mockStorage.getVisitor.mockResolvedValue(null);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Incomplete PII");
    });
  });

  describe("Lead Assembly", () => {

    it("should assemble lead package with complete data", async () => {
      const creditResult = {
        approved: true,
        creditScore: 720,
        approvedAmount: 25000,
        interestRate: 4.5,
      };

      const result = await agent.packageAndSubmitLead(1, "test_source", creditResult);

      expect(result.success).toBe(true);
      expect(result.leadPackageId).toBeDefined();
    });

    it("should include engagement data in lead package", async () => {
      mockStorage.getEmailCampaignsByVisitor.mockResolvedValue([{}, {}]); // 2 campaigns
      mockStorage.getChatSessionsByVisitor.mockResolvedValue([{}]); // 1 session

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(true);
      expect(mockStorage.getEmailCampaignsByVisitor).toHaveBeenCalledWith(1);
      expect(mockStorage.getChatSessionsByVisitor).toHaveBeenCalledWith(1);
    });

    it("should handle missing engagement data gracefully", async () => {
      mockStorage.getEmailCampaignsByVisitor.mockRejectedValue(new Error("DB error"));
      mockStorage.getChatSessionsByVisitor.mockResolvedValue([]);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(false);
      expect(result.error).toContain("DB error");
    });
  });

  describe("Boberdoo Submission", () => {

    it("should submit to Boberdoo when configured", async () => {
      // Mock Boberdoo config as configured
      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: true,
        vendorId: "test_vendor",
        vendorPassword: "test_pass",
      });

      mockBoberdooService.submitLeadWithRetry.mockResolvedValue({
        success: true,
        status: "accepted",
        price: 150,
        buyerId: "buyer_123",
      });

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(true);
      expect(result.revenue).toBe(150);
      expect(result.boberdooStatus).toBe("accepted");
      expect(mockBoberdooService.submitLeadWithRetry).toHaveBeenCalled();
    });

    it("should fallback to dealer CRM when Boberdoo fails", async () => {
      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: true,
        vendorId: "test_vendor",
        vendorPassword: "test_pass",
      });

      mockBoberdooService.submitLeadWithRetry.mockResolvedValue({
        success: false,
        message: "Boberdoo error",
      });

      // Mock WebhookService
      const mockWebhookService = {
        submitToDealerCrm: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.spyOn(agent as any, "webhookService", "get").mockReturnValue(mockWebhookService);
      mockStorage.updateLead.mockResolvedValue({});

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(true);
      expect(mockWebhookService.submitToDealerCrm).toHaveBeenCalled();
    });

    it("should handle Boberdoo validation errors", async () => {
      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: true,
        vendorId: "test_vendor",
        vendorPassword: "test_pass",
      });

      // Create invalid visitor data for Boberdoo
      const invalidVisitor = { ...mockVisitor, phoneNumber: null };
      mockStorage.getVisitor.mockResolvedValue(invalidVisitor);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Incomplete PII");
    });
  });

  describe("Dealer CRM Submission", () => {

    it("should submit to dealer CRM when Boberdoo not configured", async () => {
      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: false,
      });

      const mockWebhookService = {
        submitToDealerCrm: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.spyOn(agent as any, "webhookService", "get").mockReturnValue(mockWebhookService);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(true);
      expect(mockWebhookService.submitToDealerCrm).toHaveBeenCalled();
      expect(mockStorage.updateLead).toHaveBeenCalledWith("lead_123", {
        status: "qualified",
      });
    });

    it("should handle dealer CRM submission failure", async () => {
      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: false,
      });

      const mockWebhookService = {
        submitToDealerCrm: vi.fn().mockResolvedValue({
          success: false,
          error: "CRM error",
        }),
      };
      vi.spyOn(agent as any, "webhookService", "get").mockReturnValue(mockWebhookService);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(false);
      expect(result.error).toContain("CRM error");
    });
  });

  describe("Error Handling", () => {
    it("should handle storage errors gracefully", async () => {
      mockStorage.getVisitor.mockRejectedValue(new Error("Database connection failed"));

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database connection failed");
    });

    it("should handle validation schema errors", async () => {
      // Mock visitor with invalid data that passes initial checks but fails schema validation
      const invalidVisitor = { ...mockVisitor, annualIncome: "invalid" };
      mockStorage.getVisitor.mockResolvedValue(invalidVisitor);

      const result = await agent.packageAndSubmitLead(1, "test_source");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should log activities for failed submissions", async () => {
      mockStorage.getVisitor.mockResolvedValue(mockVisitor);
      mockStorage.getEmailCampaignsByVisitor.mockResolvedValue([]);
      mockStorage.getChatSessionsByVisitor.mockResolvedValue([]);
      mockStorage.createLead.mockResolvedValue({ id: "lead_123" });

      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: false,
      });

      const mockWebhookService = {
        submitToDealerCrm: vi.fn().mockResolvedValue({
          success: false,
          error: "Submission failed",
        }),
      };
      vi.spyOn(agent as any, "webhookService", "get").mockReturnValue(mockWebhookService);

      await agent.packageAndSubmitLead(1, "test_source");

      expect(mockStorage.createAgentActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: "LeadPackagingAgent",
          action: "dealer_crm_failed",
          status: "error",
        })
      );
    });
  });

  describe("Credit Check Integration", () => {

    it("should include credit check results in lead package", async () => {
      const creditResult = {
        approved: true,
        creditScore: 680,
        approvedAmount: 20000,
        interestRate: 5.9,
        checkDate: new Date(),
      };

      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: false,
      });

      const mockWebhookService = {
        submitToDealerCrm: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.spyOn(agent as any, "webhookService", "get").mockReturnValue(mockWebhookService);
      mockStorage.createLead.mockResolvedValue({ id: "lead_123" });
      mockStorage.updateLead.mockResolvedValue({});
      mockStorage.createAgentActivity.mockResolvedValue({});

      const result = await agent.packageAndSubmitLead(1, "test_source", creditResult);

      expect(result.success).toBe(true);
      expect(mockWebhookService.submitToDealerCrm).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCheck: expect.objectContaining({
            approved: true,
            creditScore: 680,
            approvedAmount: 20000,
            interestRate: 5.9,
          }),
        })
      );
    });

    it("should handle declined credit applications", async () => {
      const creditResult = {
        approved: false,
        denialReason: "Insufficient income",
        checkDate: new Date(),
      };

      vi.spyOn(agent as any, "boberdooConfig", "get").mockReturnValue({
        configured: false,
      });

      const mockWebhookService = {
        submitToDealerCrm: vi.fn().mockResolvedValue({ success: true }),
      };
      vi.spyOn(agent as any, "webhookService", "get").mockReturnValue(mockWebhookService);
      mockStorage.createLead.mockResolvedValue({ id: "lead_123" });
      mockStorage.updateLead.mockResolvedValue({});
      mockStorage.createAgentActivity.mockResolvedValue({});

      const result = await agent.packageAndSubmitLead(1, "test_source", creditResult);

      expect(result.success).toBe(true);
      expect(mockWebhookService.submitToDealerCrm).toHaveBeenCalledWith(
        expect.objectContaining({
          creditCheck: expect.objectContaining({
            approved: false,
            denialReason: "Insufficient income",
          }),
        })
      );
    });
  });
});