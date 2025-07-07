// server/agents/chat-agent-simple.ts
export class ChatAgentSimple {
  private responses = {
    greeting: "Hi! How can I help you today?",
    qualification: "Could you tell me more about what you're looking for?",
    contact: "I'd be happy to have someone reach out. What's the best way to contact you?",
    thanks: "Thank you! Someone from our team will be in touch soon.",
    default: "I understand. Let me get someone who can better assist you."
  };
  
  async processLead(lead: any, decision: any) {
    return {
      message: this.responses.greeting,
      shouldQualify: true
    };
  }
  
  async processMessage(message: string, context: any[], lead: any) {
    const lowerMessage = message.toLowerCase();
    
    // Simple keyword-based responses
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      return {
        content: "Our pricing varies based on your needs. Could you tell me more about your requirements?",
        shouldHandover: false
      };
    }
    
    if (lowerMessage.includes('contact') || lowerMessage.includes('call')) {
      return {
        content: this.responses.contact,
        shouldHandover: false
      };
    }
    
    if (lowerMessage.includes('thank')) {
      return {
        content: this.responses.thanks,
        shouldHandover: false
      };
    }
    
    // Default to handover for complex queries
    return {
      content: this.responses.default,
      shouldHandover: true,
      handoverReason: "Complex query requires human assistance"
    };
  }
}
