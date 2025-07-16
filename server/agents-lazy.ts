// server/agents-lazy.ts
// Lazy-loading agent system - only loads what's needed when it's needed

let overlordAgent: any;
let activeAgents = new Map<string, any>();

// Lazy agent loader
async function loadAgent(type: string) {
  if (activeAgents.has(type)) {
    return activeAgents.get(type);
  }
  
  switch (type) {
    case 'overlord':
      if (!overlordAgent) {
        const { OverlordAgent } = await import('./agents/overlord-agent');
        overlordAgent = new OverlordAgent();
      }
      return overlordAgent;
      
    case 'email':
      const { EmailAgentSimple } = await import('./agents/email-agent-simple');
      const emailAgent = new EmailAgentSimple();
      activeAgents.set('email', emailAgent);
      return emailAgent;
      
    case 'sms':
      const { SMSAgentSimple } = await import('./agents/sms-agent-simple');
      const smsAgent = new SMSAgentSimple();
      activeAgents.set('sms', smsAgent);
      return smsAgent;
      
    case 'chat':
      const { ChatAgentSimple } = await import('./agents/chat-agent-simple');
      const chatAgent = new ChatAgentSimple();
      activeAgents.set('chat', chatAgent);
      return chatAgent;
      
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}

// Main lead processing function
export async function processLead(lead: any) {
  // Only load overlord agent when processing
  const overlord = await loadAgent('overlord');
  
  // Make routing decision
  const decision = await overlord.makeDecision({ lead });
  
  // Only load the specific channel agent if needed
  if (decision.action === 'assign_channel' && decision.data.channel) {
    const channel = decision.data.channel;
    const agent = await loadAgent(channel);
    
    // Process with the channel agent
    await agent.processLead(lead, decision);
    
    // Unload agent if memory is tight
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed / memUsage.heapTotal > 0.8) {
      activeAgents.delete(channel);
      global.gc && global.gc();
    }
  }
  
  return decision;
}

// Clean up inactive agents periodically
setInterval(() => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
    // Clear all channel agents but keep overlord
    activeAgents.clear();
    global.gc && global.gc();
  }
}, 60000); // Every minute

export { loadAgent };
