// WebSocket Service - handles real-time connections only
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import express from 'express';
import { LeadsRepository, ConversationsRepository } from '../../server/db';
import { nanoid } from 'nanoid';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3003;

// Track active connections (minimal memory)
const connections = new Map<string, any>();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'websocket',
    connections: connections.size 
  });
});

wss.on('connection', (ws) => {
  const connectionId = nanoid();
  connections.set(connectionId, { ws, leadId: null });
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'chat:init':
          // Create or get lead
          let lead;
          if (data.leadId) {
            lead = await LeadsRepository.findById(data.leadId);
          } else {
            lead = await LeadsRepository.create({
              name: data.name || 'Chat Visitor',
              email: data.email || `chat_${Date.now()}@anonymous.com`,
              phone: data.phone || '0000000000',
              source: 'chat_widget',
              status: 'new',
              metadata: { sessionId: data.sessionId }
            });
          }
          
          connections.get(connectionId).leadId = lead.id;
          
          ws.send(JSON.stringify({
            type: 'chat:connected',
            leadId: lead.id,
            sessionId: data.sessionId
          }));
          break;
          
        case 'chat:message':
          const conn = connections.get(connectionId);
          if (!conn.leadId) break;
          
          // Save message to database
          const conversation = await ConversationsRepository.findActiveByLeadId(conn.leadId) ||
                             await ConversationsRepository.create(conn.leadId, 'chat');
          
          await ConversationsRepository.appendMessage(
            conversation.id,
            'user',
            data.content
          );
          
          // Call agent service for response
          const response = await fetch(`${process.env.AGENT_SERVICE_URL}/chat-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: conn.leadId,
              message: data.content,
              conversationId: conversation.id
            })
          }).then(r => r.json());
          
          // Send response
          ws.send(JSON.stringify({
            type: 'chat:message',
            content: response.content,
            sender: 'agent'
          }));
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Processing failed' }));
    }
  });
  
  ws.on('close', () => {
    connections.delete(connectionId);
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket Service running on port ${PORT}`);
  console.log(`Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});