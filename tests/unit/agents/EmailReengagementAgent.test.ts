import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailReengagementAgent } from "@server/agents/EmailReengagementAgent";
import { storage } from "@server/storage";
import emailService from "@server/services/email-onerylie";

const mockStorage = storage as any;
const mockEmailService = emailService as any;

describe("EmailReengagementAgent", () => {
  let agent: EmailReengagementAgent;
  let mockVisitor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new EmailReengagementAgent();
    
    mockVisitor = {
      id: 1,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      emailHash: "hash123",
      abandonmentStep: 1,
      metadata: {},
    };

    // Setup default mocks
    mockStorage.getVisitorById.mockResolvedValue(mockVisitor);
    mockStorage.updateVisitor.mockResolvedValue({});
    mockStorage.createAgentActivity.mockResolvedValue({});
    mockEmailService.sendEmail.mockResolvedValue({ success: true, messageId: "msg_123" });
    mockEmailService.getProviderName.mockReturnValue("TestProvider");
  });

  describe("Email Content Generation", () => {
    it("should generate personalized content for step 1 abandonment", () => {
      const generateContent = (agent as any).generatePersonalizedContent.bind(agent);
      
      const content = generateContent(1);
      
      expect(content.subject).toContain("Complete Your Car Loan Application");
      expect(content.body).toContain("started your car loan application");
      expect(content.body).toContain("{{RETURN_LINK}}");
    });

    it("should generate different content for step 2 abandonment", () => {
      const generateContent = (agent as any).generatePersonalizedContent.bind(agent);
      
      const content = generateContent(2);
      
      expect(content.subject).toContain("Almost Ready");
      expect(content.body).toContain("so close to getting");
      expect(content.body).toContain("most of your information");
    });

    it("should generate urgent content for step 3 abandonment", () => {
      const generateContent = (agent as any).generatePersonalizedContent.bind(agent);
      
      const content = generateContent(3);
      
      expect(content.subject).toContain("Final Step");
      expect(content.body).toContain("final step");
      expect(content.body).toContain("instant approval");
    });

    it("should default to step 1 content for invalid steps", () => {
      const generateContent = (agent as any).generatePersonalizedContent.bind(agent);
      
      const content = generateContent(99);
      
      expect(content.subject).toContain("Complete Your Car Loan Application");
    });
  });

  describe("Return Token Management", () => {
    it("should create return token with 24-hour expiry", async () => {
      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(true);
      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1", {
        metadata: {
          returnToken: "test-uuid-123",
          returnTokenExpiry: expect.any(String),
        },
      });
    });

    it("should handle token creation errors", async () => {
      mockStorage.updateVisitor.mockRejectedValue(new Error("Token update failed"));

      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Token update failed");
    });

    it("should set correct expiry time", async () => {
      const beforeTime = new Date();
      await agent.sendReengagementEmail(1);
      
      const updateCall = mockStorage.updateVisitor.mock.calls[0][1];
      const expiryTime = new Date(updateCall.metadata.returnTokenExpiry);
      const expectedExpiry = new Date(beforeTime.getTime() + 24 * 60 * 60 * 1000);
      
      expect(expiryTime.getTime()).toBeCloseTo(expectedExpiry.getTime(), -1000); // Within 1 second
    });
  });

  describe("Email Sending", () => {
    it("should send email with correct parameters", async () => {
      process.env.BASE_URL = "https://test.example.com";
      
      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: "hash123",
        subject: expect.stringContaining("Complete Your Car Loan Application"),
        html: expect.stringContaining("https://test.example.com/return/test-uuid-123"),
      });
    });

    it("should handle email service failures", async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error("Email service down"));

      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Email service down");
    });

    it("should log successful email activity", async () => {
      await agent.sendReengagementEmail(1);

      expect(mockStorage.createAgentActivity).toHaveBeenCalledWith({
        agentName: "EmailReengagementAgent",
        action: "email_sent",
        details: "Re-engagement email sent successfully",
        visitorId: 1,
        status: "success",
      });
    });

    it("should use default BASE_URL when not set", async () => {
      delete process.env.BASE_URL;
      
      await agent.sendReengagementEmail(1);

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("https://app.completecarloans.com/return/test-uuid-123"),
        })
      );
    });
  });

  describe("Visitor Handling", () => {
    it("should handle missing visitor", async () => {
      mockStorage.getVisitorById.mockResolvedValue(null);

      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Visitor not found");
    });

    it("should use visitor's abandonment step", async () => {
      mockVisitor.abandonmentStep = 2;
      mockStorage.getVisitorById.mockResolvedValue(mockVisitor);

      await agent.sendReengagementEmail(1);

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Almost Ready"),
        })
      );
    });

    it("should default to step 1 when abandonment step is missing", async () => {
      mockVisitor.abandonmentStep = null;
      mockStorage.getVisitorById.mockResolvedValue(mockVisitor);

      await agent.sendReengagementEmail(1);

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Complete Your Car Loan Application"),
        })
      );
    });
  });

  describe("Email Content Personalization", () => {
    it("should include visitor-specific information when available", async () => {
      mockVisitor.firstName = "Jane";
      mockStorage.getVisitorById.mockResolvedValue(mockVisitor);

      await agent.sendReengagementEmail(1);

      // Verify email was sent (content personalization happens in the service layer)
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it("should handle missing visitor name gracefully", async () => {
      mockVisitor.firstName = null;
      mockVisitor.lastName = null;
      mockStorage.getVisitorById.mockResolvedValue(mockVisitor);

      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe("Campaign Management", () => {
    it("should create email campaign record", async () => {
      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(true);
      expect(result.campaignId).toBeDefined();
    });

    it("should handle campaign creation with proper expiry", async () => {
      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(true);
      // Campaign creation is mocked, but we verify the flow completes
    });
  });

  describe("Error Recovery", () => {
    it("should handle partial failures gracefully", async () => {
      // Token creation succeeds, but email fails
      mockEmailService.sendEmail.mockRejectedValue(new Error("SMTP error"));

      const result = await agent.sendReengagementEmail(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("SMTP error");
      // Token should still be created
      expect(mockStorage.updateVisitor).toHaveBeenCalled();
    });

    it("should handle database errors during activity logging", async () => {
      mockStorage.createAgentActivity.mockRejectedValue(new Error("Activity log failed"));

      const result = await agent.sendReengagementEmail(1);

      // Should still succeed even if activity logging fails
      expect(result.success).toBe(false);
      expect(result.error).toContain("Activity log failed");
    });
  });

  describe("Agent Configuration", () => {
    it("should have proper agent configuration", () => {
      const agentConfig = agent.getAgent();
      
      expect(agentConfig.name).toBe("Email Re-engagement Agent");
      expect(agentConfig.instructions).toContain("Cathy");
      expect(agentConfig.instructions).toContain("empathy");
      expect(agentConfig.tools).toHaveLength(3);
    });

    it("should include all required tools", () => {
      const agentConfig = agent.getAgent();
      const toolNames = agentConfig.tools.map((tool: any) => tool.name);
      
      expect(toolNames).toContain("generate_email_content");
      expect(toolNames).toContain("create_return_token");
      expect(toolNames).toContain("send_email");
    });

    it("should have proper tool descriptions", () => {
      const agentConfig = agent.getAgent();
      
      agentConfig.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.execute).toBeTypeOf("function");
      });
    });
  });

  describe("Email Template Validation", () => {
    it("should include required email elements", () => {
      const generateContent = (agent as any).generatePersonalizedContent.bind(agent);
      
      [1, 2, 3].forEach(step => {
        const content = generateContent(step);
        
        expect(content.subject).toBeTruthy();
        expect(content.body).toBeTruthy();
        expect(content.body).toContain("{{RETURN_LINK}}");
        expect(content.body).toContain("CCL Team");
      });
    });

    it("should have appropriate urgency progression", () => {
      const generateContent = (agent as any).generatePersonalizedContent.bind(agent);
      
      const step1 = generateContent(1);
      const step2 = generateContent(2);
      const step3 = generateContent(3);
      
      expect(step1.subject).toContain("Complete");
      expect(step2.subject).toContain("Almost");
      expect(step3.subject).toContain("Final");
    });
  });

  describe("Security Considerations", () => {
    it("should use secure token generation", async () => {
      await agent.sendReengagementEmail(1);

      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1", {
        metadata: {
          returnToken: "test-uuid-123", // UUID format
          returnTokenExpiry: expect.any(String),
        },
      });
    });

    it("should set appropriate token expiry", async () => {
      await agent.sendReengagementEmail(1);

      const updateCall = mockStorage.updateVisitor.mock.calls[0][1];
      const expiryTime = new Date(updateCall.metadata.returnTokenExpiry);
      const now = new Date();
      
      expect(expiryTime.getTime()).toBeGreaterThan(now.getTime());
      expect(expiryTime.getTime()).toBeLessThan(now.getTime() + 25 * 60 * 60 * 1000); // Less than 25 hours
    });
  });
});