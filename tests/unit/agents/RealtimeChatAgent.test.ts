import { describe, it, expect, beforeEach, vi } from "vitest";
import { RealtimeChatAgent } from "@server/agents/RealtimeChatAgent";
import { storage } from "@server/storage";

const mockStorage = storage as any;

describe("RealtimeChatAgent", () => {
  let agent: RealtimeChatAgent;
  let mockVisitor: any;
  let mockChatSession: any;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new RealtimeChatAgent();
    
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
    };

    mockChatSession = {
      id: "session_123",
      sessionId: "test_session",
      visitorId: 1,
      messages: [],
      isActive: true,
    };
  });

  describe("Chat Message Handling", () => {
    beforeEach(() => {
      mockStorage.getChatSessionBySessionId.mockResolvedValue(mockChatSession);
      mockStorage.updateChatSession.mockResolvedValue({});
    });

    it("should handle first-time user messages", async () => {
      const result = await agent.handleChatMessage("test_session", "Hello, I need help with a car loan");

      expect(result.success).toBe(true);
      expect(result.response).toContain("Hi there");
      expect(mockStorage.updateChatSession).toHaveBeenCalled();
    });

    it("should create new chat session if none exists", async () => {
      mockStorage.getChatSessionBySessionId.mockResolvedValue(null);
      mockStorage.createChatSession.mockResolvedValue(mockChatSession);

      const result = await agent.handleChatMessage("new_session", "Hello");

      expect(mockStorage.createChatSession).toHaveBeenCalledWith({
        sessionId: "new_session",
        visitorId: null,
        messages: [],
      });
      expect(result.success).toBe(true);
    });

    it("should detect and handle phone numbers", async () => {
      const result = await agent.handleChatMessage("test_session", "My phone number is 555-123-4567", 1);

      expect(result.success).toBe(true);
      expect(result.shouldHandoff).toBe(true);
      expect(result.phoneNumber).toBe("+15551234567");
      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1", {
        phoneNumber: "+15551234567",
      });
    });

    it("should extract and collect PII from messages", async () => {
      mockStorage.getVisitor.mockResolvedValue({ ...mockVisitor, firstName: null });
      mockStorage.updateVisitor.mockResolvedValue({});

      const result = await agent.handleChatMessage(
        "test_session", 
        "My name is Jane Smith and I work at ABC Corp", 
        1
      );

      expect(result.success).toBe(true);
      expect(result.piiCollected).toBe(true);
      expect(mockStorage.updateVisitor).toHaveBeenCalledWith("1", 
        expect.objectContaining({
          employer: "ABC Corp",
        })
      );
    });

    it("should trigger lead packaging when PII is complete", async () => {
      mockStorage.getVisitor.mockResolvedValue(mockVisitor);
      mockStorage.updateVisitor.mockResolvedValue({});
      mockStorage.createAgentActivity.mockResolvedValue({});

      const result = await agent.handleChatMessage(
        "test_session", 
        "My email is john@example.com", 
        1
      );

      expect(result.success).toBe(true);
      expect(result.leadPackagingTriggered).toBe(true);
      expect(mockStorage.createAgentActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: "RealtimeChatAgent",
          action: "lead_packaging_triggered",
        })
      );
    });
  });

  describe("PII Extraction", () => {
    it("should extract names from natural language", () => {
      const extractPii = (agent as any).extractPiiFromMessage.bind(agent);
      
      const result1 = extractPii("My name is John Doe");
      expect(result1.firstName).toBe("John");
      expect(result1.lastName).toBe("Doe");

      const result2 = extractPii("I'm Jane Smith");
      expect(result2.firstName).toBe("Jane");
      expect(result2.lastName).toBe("Smith");

      const result3 = extractPii("Call me Mike");
      expect(result3.firstName).toBe("Mike");
    });

    it("should extract email addresses", () => {
      const extractPii = (agent as any).extractPiiFromMessage.bind(agent);
      
      const result = extractPii("My email is john.doe@example.com");
      expect(result.email).toBe("john.doe@example.com");
    });

    it("should extract employment information", () => {
      const extractPii = (agent as any).extractPiiFromMessage.bind(agent);
      
      const result1 = extractPii("I work at Google as a Software Engineer");
      expect(result1.employer).toBe("Google");
      expect(result1.jobTitle).toBe("Software Engineer");

      const result2 = extractPii("My employer is Microsoft");
      expect(result2.employer).toBe("Microsoft");
    });

    it("should extract income information", () => {
      const extractPii = (agent as any).extractPii.bind(agent);
      
      const result1 = extractPii("I make $75,000 per year");
      expect(result1.annualIncome).toBe(75000);

      const result2 = extractPii("My salary is $50000 annually");
      expect(result2.annualIncome).toBe(50000);
    });

    it("should extract address information", () => {
      const extractPii = (agent as any).extractPiiFromMessage.bind(agent);
      
      const result = extractPii("I live at 123 Main St, Anytown, CA 12345");
      expect(result.street).toBe("123 Main St");
      expect(result.city).toBe("Anytown");
      expect(result.state).toBe("CA");
      expect(result.zip).toBe("12345");
    });
  });

  describe("PII Completeness Checking", () => {
    it("should identify complete PII", async () => {
      mockStorage.getVisitor.mockResolvedValue(mockVisitor);

      const result = await agent.handleChatMessage("test_session", "Hello", 1);

      expect(mockStorage.getVisitor).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });

    it("should identify missing PII fields", async () => {
      const incompleteVisitor = { ...mockVisitor, firstName: null, lastName: null };
      mockStorage.getVisitor.mockResolvedValue(incompleteVisitor);

      const result = await agent.handleChatMessage("test_session", "Hello", 1);

      expect(result.success).toBe(true);
      expect(result.response).toContain("name");
    });

    it("should guide users to provide missing information", async () => {
      const partialVisitor = { ...mockVisitor, employer: null, jobTitle: null };
      mockStorage.getVisitor.mockResolvedValue(partialVisitor);

      const result = await agent.handleChatMessage("test_session", "I need help with work info", 1);

      expect(result.success).toBe(true);
      expect(result.response.toLowerCase()).toMatch(/work|employ|job/);
    });
  });

  describe("Contextual Responses", () => {
    beforeEach(() => {
      mockStorage.getVisitor.mockResolvedValue(mockVisitor);
    });

    it("should provide empathetic responses to frustrated users", async () => {
      const result = await agent.handleChatMessage(
        "test_session", 
        "I'm so frustrated, I was denied everywhere else", 
        1
      );

      expect(result.success).toBe(true);
      expect(result.response.toLowerCase()).toMatch(/understand|frustrat|help/);
    });

    it("should handle urgent requests appropriately", async () => {
      const result = await agent.handleChatMessage(
        "test_session", 
        "I need a car loan ASAP, it's urgent", 
        1
      );

      expect(result.success).toBe(true);
      expect(result.response.toLowerCase()).toMatch(/urgent|quick|fast/);
    });

    it("should address credit concerns with reassurance", async () => {
      const result = await agent.handleChatMessage(
        "test_session", 
        "I have bad credit, can you still help?", 
        1
      );

      expect(result.success).toBe(true);
      expect(result.response.toLowerCase()).toMatch(/credit|help|situation/);
    });

    it("should provide rate and payment information", async () => {
      const result = await agent.handleChatMessage(
        "test_session", 
        "What rates do you offer? What would my monthly payment be?", 
        1
      );

      expect(result.success).toBe(true);
      expect(result.response.toLowerCase()).toMatch(/rate|payment|apr/);
    });
  });

  describe("Error Handling", () => {
    it("should handle storage errors gracefully", async () => {
      mockStorage.getChatSessionBySessionId.mockRejectedValue(new Error("Database error"));

      const result = await agent.handleChatMessage("test_session", "Hello");

      expect(result.success).toBe(false);
      expect(result.response).toContain("technical difficulties");
      expect(result.error).toContain("Database error");
    });

    it("should handle visitor update failures", async () => {
      mockStorage.getChatSessionBySessionId.mockResolvedValue(mockChatSession);
      mockStorage.getVisitor.mockResolvedValue({ ...mockVisitor, firstName: null });
      mockStorage.updateVisitor.mockRejectedValue(new Error("Update failed"));

      const result = await agent.handleChatMessage(
        "test_session", 
        "My name is John", 
        1
      );

      expect(result.success).toBe(true); // Should still respond to user
      expect(result.piiCollected).toBe(false);
    });

    it("should handle session creation failures", async () => {
      mockStorage.getChatSessionBySessionId.mockResolvedValue(null);
      mockStorage.createChatSession.mockRejectedValue(new Error("Session creation failed"));

      const result = await agent.handleChatMessage("new_session", "Hello");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Session creation failed");
    });
  });

  describe("Phone Number Formatting", () => {
    it("should format phone numbers correctly", () => {
      const formatPhone = (agent as any).formatPhoneNumber.bind(agent);
      
      expect(formatPhone("5551234567")).toBe("+15551234567");
      expect(formatPhone("15551234567")).toBe("+15551234567");
      expect(formatPhone("(555) 123-4567")).toBe("+15551234567");
      expect(formatPhone("555-123-4567")).toBe("+15551234567");
    });

    it("should handle invalid phone numbers", () => {
      const formatPhone = (agent as any).formatPhoneNumber.bind(agent);
      
      expect(formatPhone("invalid")).toBe("invalid");
      expect(formatPhone("123")).toBe("123");
    });
  });

  describe("Welcome Messages", () => {
    it("should generate appropriate welcome messages", () => {
      const generateWelcome = (agent as any).generateWelcomeResponse.bind(agent);
      
      const frustrated = generateWelcome("I'm frustrated, I was denied everywhere");
      expect(frustrated.toLowerCase()).toMatch(/understand|frustrat/);

      const urgent = generateWelcome("I need a car urgently");
      expect(urgent.toLowerCase()).toMatch(/urgent|quick/);

      const credit = generateWelcome("I have bad credit");
      expect(credit.toLowerCase()).toMatch(/credit|situation/);
    });

    it("should provide default welcome for general messages", () => {
      const generateWelcome = (agent as any).generateWelcomeResponse.bind(agent);
      
      const general = generateWelcome("Hello, I need help");
      expect(general).toContain("Hi there");
    });
  });

  describe("Agent Configuration", () => {
    it("should have proper agent configuration", () => {
      const agentConfig = agent.getAgent();
      
      expect(agentConfig.name).toContain("Cathy");
      expect(agentConfig.instructions).toContain("empathetic");
      expect(agentConfig.tools).toHaveLength(4);
    });

    it("should include all required tools", () => {
      const agentConfig = agent.getAgent();
      const toolNames = agentConfig.tools.map((tool: any) => tool.name);
      
      expect(toolNames).toContain("check_pii_completeness");
      expect(toolNames).toContain("collect_pii");
      expect(toolNames).toContain("trigger_lead_packaging");
      expect(toolNames).toContain("handle_user_message");
    });
  });
});