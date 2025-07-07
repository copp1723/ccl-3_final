# CCL-3 SWARM Project - Agent Communication Flow Implementation

## 🎯 Project Context

You're working on the **CCL-3 SWARM** (Collaborative Customer Lead version 3 - Scalable Workforce of Automated Resource Management) project. This is a multi-agent system designed to automatically qualify and nurture leads through intelligent routing and personalized communication.

### Architecture Overview:
- **Overlord Agent**: The decision maker that evaluates leads and routes them to appropriate channels
- **Email Agent**: Handles email communications via Mailgun
- **SMS Agent**: Manages text messaging via Twilio
- **Chat Agent**: Provides real-time chat interactions
- **Database Layer**: Complete persistence layer using Drizzle ORM
- **WebSocket Server**: Real-time communication backbone
- **Boberdoo Integration**: External lead source API
- **Lead Import**: CSV bulk upload functionality

### Current State:
✅ **COMPLETED**:
1. Full database implementation with repositories
2. All agent classes built and configured
3. Boberdoo API integration for receiving leads
4. CSV import functionality for bulk lead upload
5. WebSocket server running
6. Frontend UI with tabs for monitoring
7. Campaign and communication tracking systems

❌ **MISSING**: The agents are built but never actually called! When leads arrive (via Boberdoo or CSV import), they're saved to the database but nothing happens next. The system is like a beautiful car with no connection between the engine and the wheels.

## 🔧 Development Ticket: Connect Agent Communication Flow

### Problem Statement
The system can receive leads through two channels (Boberdoo API and CSV import), but these leads are never processed by the agents. The WebSocket server broadcasts new lead events, but there's no handler that triggers the agent workflow. As a result:
- Leads sit in the database unprocessed
- No emails are sent via Mailgun
- No SMS messages go through Twilio
- No qualification scores are updated
- The beautiful agent architecture goes unused

### Technical Requirements

#### 1. WebSocket Lead Processing Handler
Update `/server/index.ts` to handle new leads:

```typescript
// When a new lead arrives (from any source)
async function processNewLead(lead: Lead) {
  // 1. Get Overlord Agent instance
  const overlord = getOverlordAgent();
  
  // 2. Make routing decision
  const decision = await overlord.makeDecision({ lead });
  
  // 3. Record the decision
  await AgentDecisionsRepository.create({
    leadId: lead.id,
    agentType: 'overlord',
    action: 'route_lead',
    data: decision.data,
    reasoning: decision.reasoning
  });
  
  // 4. Get the appropriate agent
  const agent = getAgentByType(decision.data.channel); // email/sms/chat
  
  // 5. Process initial contact
  const response = await agent.processInitialContact(lead);
  
  // 6. Save the conversation
  await ConversationsRepository.create({
    leadId: lead.id,
    agentType: decision.data.channel,
    direction: 'outbound',
    content: response.content,
    metadata: response.metadata
  });
  
  // 7. Actually send the message
  if (decision.data.channel === 'email') {
    await agent.sendEmail(lead.email, response.content);
  } else if (decision.data.channel === 'sms') {
    await agent.sendSMS(lead.phone, response.content);
  }
  
  // 8. Broadcast updates to WebSocket clients
  broadcastAgentUpdate({
    type: 'lead_processed',
    lead,
    decision,
    conversation: response
  });
}
```

#### 2. Integration Points to Update

**A. Boberdoo Route** (`/server/routes/boberdoo.ts`):
- After saving lead, call `processNewLead(savedLead)`

**B. Import Route** (`/server/routes/import.ts`):
- Currently makes Overlord decisions but doesn't trigger communication
- Update to use the same `processNewLead` function

**C. WebSocket Message Handler**:
- Add handler for manual lead processing triggers
- Handle agent response updates

#### 3. Agent Method Implementations

Ensure these methods are properly implemented in each agent:

**Email Agent** (`/server/agents/email.ts`):
- `processInitialContact(lead)`: Generate personalized email
- `sendEmail(to, content)`: Actually send via Mailgun
- `handleResponse(lead, response)`: Process replies

**SMS Agent** (`/server/agents/sms.ts`):
- `processInitialContact(lead)`: Create SMS message
- `sendSMS(to, content)`: Send via Twilio
- `handleIncoming(from, message)`: Process responses

**Chat Agent** (`/server/agents/chat.ts`):
- `processInitialContact(lead)`: Initialize chat session
- `sendMessage(sessionId, content)`: Send chat message
- `handleMessage(sessionId, message)`: Process chat input

#### 4. Webhook Handlers

The communication routes exist but need to trigger agent processing:

**Mailgun Webhook** (`/server/routes/communications.ts`):
```typescript
router.post('/api/webhooks/mailgun', async (req, res) => {
  // Current: Just saves to database
  // Need: Also trigger EmailAgent.handleResponse()
});
```

**Twilio Webhook**:
```typescript
router.post('/api/webhooks/twilio', async (req, res) => {
  // Current: Just saves to database  
  // Need: Also trigger SMSAgent.handleIncoming()
});
```

### 🎯 Acceptance Criteria

1. **Lead Flow Works End-to-End**:
   - Import a CSV of leads
   - See Overlord Agent make decisions in the logs
   - Watch appropriate agents send actual emails/SMS
   - View conversations in the database

2. **Real Communications Sent**:
   - Emails actually go out via Mailgun
   - SMS messages send through Twilio
   - Chat sessions are created and manageable

3. **Bidirectional Communication**:
   - Webhook handlers process replies
   - Agents respond to incoming messages
   - Conversation threads are maintained

4. **WebSocket Updates**:
   - Frontend receives real-time updates
   - Agent decisions appear in UI
   - Conversation count updates live

### 📁 Key Files to Modify

1. `/server/index.ts` - Add lead processing logic
2. `/server/routes/boberdoo.ts` - Trigger processing after save
3. `/server/routes/import.ts` - Ensure full processing flow
4. `/server/routes/communications.ts` - Connect webhooks to agents
5. `/server/agents/*.ts` - Verify send methods work

### 🧪 Testing Approach

1. **Manual Test Flow**:
   ```bash
   # Start the server
   npm run dev
   
   # In another terminal, import test leads
   # Use the UI to import test_import_leads.csv
   
   # Check logs for:
   # - "Overlord decision made"
   # - "Email sent to..."
   # - "SMS sent to..."
   
   # Verify in database:
   # - agent_decisions table has entries
   # - conversations table shows messages
   # - communications table tracks sent items
   ```

2. **Test Webhooks**:
   ```bash
   # Simulate Mailgun webhook
   curl -X POST http://localhost:5000/api/webhooks/mailgun \
     -H "Content-Type: application/json" \
     -d '{"from":"lead@example.com","subject":"Re: Your inquiry"}'
   
   # Check that EmailAgent.handleResponse was called
   ```

### 🚀 Getting Started

1. **Review Existing Code**:
   - Check agent implementations in `/server/agents/`
   - Understand the decision flow in `overlord.ts`
   - See how communications are tracked in the DB

2. **Start Small**:
   - Pick one channel (e.g., email) and make it work end-to-end
   - Then add SMS, then chat

3. **Use the Logs**:
   - Agents have detailed logging built in
   - WebSocket broadcasts will show in browser console
   - Database queries are logged

### 💡 Pro Tips

- The Overlord Agent's `makeDecision()` returns channel preferences
- Each agent has its own personality and communication style
- The qualification score should be updated based on interactions
- WebSocket broadcasts keep the UI in sync
- Test with real API keys to see actual emails/SMS

### 🎊 Success Looks Like

When you're done, starting the server and importing a lead should trigger a beautiful cascade:
1. Lead arrives → 2. Overlord evaluates → 3. Routes to best channel → 4. Agent sends message → 5. UI updates in real-time → 6. Responses are handled → 7. Conversations build naturally

The system will finally be the living, breathing multi-agent platform it was designed to be!

## 📚 Resources

- Previous implementation notes in project root (`.md` files)
- Database schema in `/server/db/schema.ts`  
- Agent configurations in each agent file
- API docs: [Mailgun](https://documentation.mailgun.com/), [Twilio](https://www.twilio.com/docs)

Good luck! You're connecting the final pieces that will bring this system to life. 🚀
