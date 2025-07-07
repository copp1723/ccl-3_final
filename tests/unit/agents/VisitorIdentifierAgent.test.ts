import { describe, it, expect, beforeEach, vi } from "vitest";
import { VisitorIdentifierAgent, type AbandonmentEvent } from "@server/agents/VisitorIdentifierAgent";
import { storage } from "@server/storage";
import { createHash } from "crypto";

const mockStorage = storage as any;

describe("VisitorIdentifierAgent", () => {
  let agent: VisitorIdentifierAgent;
  let mockAbandonmentEvent: AbandonmentEvent;
  let mockVisitor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new VisitorIdentifierAgent();
    
    mockAbandonmentEvent = {
      sessionId: "session_123",
      email: "test@example.com",
      step: 2,
      timestamp: new Date(),
      userAgent: "Mozilla/5.0...",
      ipAddress: "192.168.1.1",
    };

    mockVisitor = {
      id: 1,
      emailHash: createHash("sha256").update("test@example.com").digest("hex"),
      sessionId: "session_123",
      abandonmentStep: 2,
    };

    // Setup default mocks
    mockStorage.getVisitorByEmailHash.mockResolvedValue(null);
    mockStorage.createVisitor.mockResolvedValue(mockVisitor);
    mockStorage.updateVisitor.mockResolvedValue(mockVisitor);
    mockStorage.getVisitor.mockResolvedValue(mockVisitor);
    mockStorage.createAgentActivity.mockResolvedValue({});
  });

  describe("Abandonment Event Processing", () => {
    it("should process new abandonment event successfully", async () => {
      const result = await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(result.success).toBe(true);
      expect(result.visitorId).toBe(1);
      expect(mockStorage.createVisitor).toHaveBeenCalledWith(
        expect.objectContaining({
          emailHash: expect.any(String),
          sessionId: "session_123",
          abandonmentStep: 2,
        })
      );
    });

    it("should update existing visitor on repeat abandonment", async () => {
      mockStorage.getVisitorByEmailHash.mockResolvedValue(mockVisitor);

      const result = await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(result.success).toBe(true);
      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1", 
        expect.objectContaining({
          emailHash: expect.any(String),
          sessionId: "session_123",
          abandonmentStep: 2,
        })
      );
      expect(mockStorage.createVisitor).not.toHaveBeenCalled();
    });

    it("should handle invalid abandonment event data", async () => {
      const invalidEvent = { ...mockAbandonmentEvent, email: "" };

      const result = await agent.processAbandonmentEvent(invalidEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should log abandonment detection activity", async () => {
      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(mockStorage.createAgentActivity).toHaveBeenCalledWith({
        agentName: "visitor_identifier",
        action: "abandonment_detected",
        details: "Abandonment detected at step 2",
        visitorId: 1,
        status: "success",
      });
    });

    it("should emit lead_ready event after processing", async () => {
      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(mockStorage.createAgentActivity).toHaveBeenCalledWith({
        agentName: "visitor_identifier",
        action: "lead_ready",
        details: "Lead ready for re-engagement after abandonment",
        visitorId: 1,
        status: "success",
      });
    });
  });

  describe("Email Hashing and PII Protection", () => {
    it("should hash email addresses consistently", () => {
      const hashEmail = (agent as any).hashEmail.bind(agent);
      
      const hash1 = hashEmail("test@example.com");
      const hash2 = hashEmail("test@example.com");
      const hash3 = hashEmail("TEST@EXAMPLE.COM");
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3); // Should normalize case
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it("should produce different hashes for different emails", () => {
      const hashEmail = (agent as any).hashEmail.bind(agent);
      
      const hash1 = hashEmail("test1@example.com");
      const hash2 = hashEmail("test2@example.com");
      
      expect(hash1).not.toBe(hash2);
    });

    it("should handle email normalization", () => {
      const hashEmail = (agent as any).hashEmail.bind(agent);
      
      const hash1 = hashEmail("  Test@Example.Com  ");
      const hash2 = hashEmail("test@example.com");
      
      expect(hash1).toBe(hash2);
    });

    it("should not store raw email addresses", async () => {
      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      const createCall = mockStorage.createVisitor.mock.calls[0][0];
      expect(createCall.email).toBeUndefined();
      expect(createCall.emailHash).toBeDefined();
      expect(createCall.emailHash).not.toBe("test@example.com");
    });
  });

  describe("Visitor Management", () => {
    it("should create new visitor when none exists", async () => {
      mockStorage.getVisitorByEmailHash.mockResolvedValue(null);

      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(mockStorage.createVisitor).toHaveBeenCalledWith(
        expect.objectContaining({
          emailHash: expect.any(String),
          sessionId: "session_123",
          abandonmentStep: 2,
        })
      );
    });

    it("should update existing visitor", async () => {
      mockStorage.getVisitorByEmailHash.mockResolvedValue(mockVisitor);

      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1",
        expect.objectContaining({
          emailHash: expect.any(String),
          sessionId: "session_123",
          abandonmentStep: 2,
        })
      );
    });

    it("should handle visitor creation failures", async () => {
      mockStorage.createVisitor.mockRejectedValue(new Error("Database error"));

      const result = await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });

    it("should handle visitor update failures", async () => {
      mockStorage.getVisitorByEmailHash.mockResolvedValue(mockVisitor);
      mockStorage.updateVisitor.mockRejectedValue(new Error("Update failed"));

      const result = await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Update failed");
    });
  });

  describe("Activity Logging", () => {
    it("should log visitor creation activity", async () => {
      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(mockStorage.createAgentActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: "visitor_identifier",
          action: "abandonment_detected",
          visitorId: 1,
          status: "success",
        })
      );
    });

    it("should log visitor update activity", async () => {
      mockStorage.getVisitorByEmailHash.mockResolvedValue(mockVisitor);

      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(mockStorage.createAgentActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: "visitor_identifier",
          action: "abandonment_detected",
          visitorId: 1,
          status: "success",
        })
      );
    });

    it("should handle activity logging failures gracefully", async () => {
      mockStorage.createAgentActivity.mockRejectedValue(new Error("Logging failed"));

      const result = await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Logging failed");
    });
  });

  describe("Data Sanitization", () => {
    it("should strip PII beyond email hash", async () => {
      const eventWithPii = {
        ...mockAbandonmentEvent,
        userAgent: "Mozilla/5.0 (sensitive data)",
        ipAddress: "192.168.1.100",
      };

      await agent.processAbandonmentEvent(eventWithPii);

      const createCall = mockStorage.createVisitor.mock.calls[0][0];
      expect(createCall.userAgent).toBeUndefined();
      expect(createCall.ipAddress).toBeUndefined();
      expect(createCall.emailHash).toBeDefined();
    });

    it("should validate required event fields", async () => {
      const invalidEvents = [
        { ...mockAbandonmentEvent, email: "" },
        { ...mockAbandonmentEvent, sessionId: "" },
        { ...mockAbandonmentEvent, step: 0 },
      ];

      for (const event of invalidEvents) {
        const result = await agent.processAbandonmentEvent(event);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("Step Tracking", () => {
    it("should track different abandonment steps", async () => {
      const steps = [1, 2, 3, 4];

      for (const step of steps) {
        const event = { ...mockAbandonmentEvent, step };
        await agent.processAbandonmentEvent(event);

        expect(mockStorage.createVisitor).toHaveBeenCalledWith(
          expect.objectContaining({
            abandonmentStep: step,
          })
        );
      }
    });

    it("should update step progression", async () => {
      // First abandonment at step 1
      mockStorage.getVisitorByEmailHash.mockResolvedValue(null);
      await agent.processAbandonmentEvent({ ...mockAbandonmentEvent, step: 1 });

      // Second abandonment at step 2
      mockStorage.getVisitorByEmailHash.mockResolvedValue({ ...mockVisitor, abandonmentStep: 1 });
      await agent.processAbandonmentEvent({ ...mockAbandonmentEvent, step: 2 });

      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1",
        expect.objectContaining({
          abandonmentStep: 2,
        })
      );
    });
  });

  describe("Agent Configuration", () => {
    it("should have proper agent configuration", () => {
      const agentConfig = agent.getAgent();
      
      expect(agentConfig.name).toBe("Visitor Identifier Agent");
      expect(agentConfig.instructions).toContain("abandonment events");
      expect(agentConfig.instructions).toContain("PII protection");
      expect(agentConfig.tools).toHaveLength(3);
    });

    it("should include all required tools", () => {
      const agentConfig = agent.getAgent();
      const toolNames = agentConfig.tools.map((tool: any) => tool.name);
      
      expect(toolNames).toContain("detect_abandonment");
      expect(toolNames).toContain("store_visitor");
      expect(toolNames).toContain("emit_lead_ready");
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

  describe("Error Handling", () => {
    it("should handle database connection errors", async () => {
      mockStorage.getVisitorByEmailHash.mockRejectedValue(new Error("Connection failed"));

      const result = await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection failed");
    });

    it("should handle malformed event data", async () => {
      const malformedEvent = {
        sessionId: null,
        email: undefined,
        step: "invalid",
      } as any;

      const result = await agent.processAbandonmentEvent(malformedEvent);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should provide meaningful error messages", async () => {
      mockStorage.createVisitor.mockRejectedValue(new Error("Unique constraint violation"));

      const result = await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unique constraint violation");
    });
  });

  describe("Session Management", () => {
    it("should handle multiple sessions for same email", async () => {
      const event1 = { ...mockAbandonmentEvent, sessionId: "session_1" };
      const event2 = { ...mockAbandonmentEvent, sessionId: "session_2" };

      await agent.processAbandonmentEvent(event1);
      
      mockStorage.getVisitorByEmailHash.mockResolvedValue(mockVisitor);
      await agent.processAbandonmentEvent(event2);

      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1",
        expect.objectContaining({
          sessionId: "session_2",
        })
      );
    });

    it("should preserve visitor data across sessions", async () => {
      const existingVisitor = { ...mockVisitor, firstName: "John", lastName: "Doe" };
      mockStorage.getVisitorByEmailHash.mockResolvedValue(existingVisitor);

      await agent.processAbandonmentEvent(mockAbandonmentEvent);

      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1",
        expect.objectContaining({
          sessionId: "session_123",
          abandonmentStep: 2,
        })
      );
    });
  });
});