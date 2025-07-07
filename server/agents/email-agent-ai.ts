// server/agents/email-agent-ai.ts
// AI-powered email agent for dynamic conversation handling

export class EmailAgentAI {
  async generateContextualResponse(context: {
    lead: any;
    conversationHistory: Array<{
      role: string;
      content: string;
      timestamp: Date;
      isTemplate?: boolean;
    }>;
    instructions: string;
  }): Promise<{ subject: string; body: string }> {
    
    // For production, you would integrate with OpenAI, Anthropic, or another AI provider
    // This is a simplified version showing the structure
    
    const lastUserMessage = context.conversationHistory
      .filter(msg => msg.role === 'user')
      .pop();

    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    // Analyze the user's message for intent
    const intent = this.analyzeIntent(lastUserMessage.content);
    
    // Generate appropriate response based on intent and context
    const response = await this.generateResponse(intent, context);
    
    return response;
  }

  private analyzeIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
      return 'pricing_inquiry';
    }
    
    if (lowerMessage.includes('schedule') || lowerMessage.includes('call') || lowerMessage.includes('meeting')) {
      return 'schedule_request';
    }
    
    if (lowerMessage.includes('more info') || lowerMessage.includes('tell me more') || lowerMessage.includes('details')) {
      return 'information_request';
    }
    
    if (lowerMessage.includes('not interested') || lowerMessage.includes('unsubscribe') || lowerMessage.includes('stop')) {
      return 'opt_out';
    }
    
    return 'general_inquiry';
  }

  private async generateResponse(
    intent: string, 
    context: any
  ): Promise<{ subject: string; body: string }> {
    
    // Build conversation summary for context
    const conversationSummary = this.buildConversationSummary(context.conversationHistory);
    
    // Generate response based on intent
    switch (intent) {
      case 'pricing_inquiry':
        return {
          subject: `Re: Pricing information for ${context.lead.name}`,
          body: `Hi ${context.lead.name},

Great question about pricing! I'd love to understand your specific needs better to provide the most accurate information.

Our solutions typically range based on:
- Team size
- Feature requirements  
- Support level needed

Would you be open to a quick 15-minute call this week? I can walk you through options that fit your budget and needs.

Here's my calendar link: [calendar-link]

Or reply with a few times that work for you.

Best regards,
The Team

P.S. ${conversationSummary}`
        };

      case 'schedule_request':
        return {
          subject: `Re: Let's schedule a call, ${context.lead.name}`,
          body: `Hi ${context.lead.name},

Perfect! I'd be happy to schedule a call with you.

Here are a few times that work on my end:
- Tomorrow at 2 PM EST
- Thursday at 10 AM EST
- Friday at 3 PM EST

You can also book directly here: [calendar-link]

The call will be about 20 minutes, and we'll cover:
✓ Your specific requirements
✓ How we can help
✓ Next steps

Looking forward to speaking with you!

Best regards,
The Team`
        };

      case 'information_request':
        return {
          subject: `Re: More details for ${context.lead.name}`,
          body: `Hi ${context.lead.name},

Absolutely! Here's a quick overview:

${this.generateRelevantInformation(context.lead)}

I've also attached a brief case study showing how we helped a similar company.

Would you like to discuss how this could work specifically for your situation? I have some time available this week.

Best regards,
The Team`
        };

      case 'opt_out':
        return {
          subject: `Re: Unsubscribe confirmed`,
          body: `Hi ${context.lead.name},

No problem at all - I've removed you from our email list.

If you ever change your mind or have questions in the future, feel free to reach out directly.

Wishing you all the best!

The Team`
        };

      default:
        return {
          subject: `Re: Following up on your message`,
          body: `Hi ${context.lead.name},

Thanks for getting back to me! 

${this.generateContextualResponse(context.conversationHistory, context.lead)}

What would be most helpful for you at this point?

Best regards,
The Team`
        };
    }
  }

  private buildConversationSummary(history: any[]): string {
    const recentMessages = history.slice(-3);
    if (recentMessages.length === 0) return '';
    
    return `Based on our conversation about ${this.extractTopics(recentMessages).join(', ')}, I thought this might be helpful.`;
  }

  private extractTopics(messages: any[]): string[] {
    // Simple topic extraction - in production, use NLP
    const topics = new Set<string>();
    
    messages.forEach(msg => {
      if (msg.content.includes('solution')) topics.add('solutions');
      if (msg.content.includes('challenge')) topics.add('challenges');
      if (msg.content.includes('help')) topics.add('getting help');
    });
    
    return Array.from(topics);
  }

  private generateRelevantInformation(lead: any): string {
    // Customize based on lead data
    return `Our platform helps businesses like yours by:

• Automating repetitive tasks (save 10+ hours/week)
• Centralizing communication (reduce response time by 50%)  
• Providing real-time insights (make data-driven decisions)

We've helped over 500 companies improve their operations.`;
  }

  private generateSimpleResponse(history: any[], lead: any): string {
    // Generate a contextual response based on conversation flow
    const lastMessage = history[history.length - 1];
    
    // This would be replaced with actual AI generation
    return `I understand you're looking for more information. Let me address your specific question about "${this.extractKeyPhrase(lastMessage.content)}".`;
  }

  private extractKeyPhrase(content: string): string {
    // Simple key phrase extraction
    const sentences = content.split(/[.!?]/);
    return sentences[0].trim().substring(0, 50) + '...';
  }
}

// Export singleton instance
export const emailAgentAI = new EmailAgentAI();
