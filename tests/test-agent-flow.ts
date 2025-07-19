#!/usr/bin/env node
/**
 * Test script to verify agent communication flow
 * Run with: npx tsx test-agent-flow.ts
 */

import { LeadsRepository, AgentDecisionsRepository, ConversationsRepository, CommunicationsRepository } from './server/db';

async function testAgentFlow() {
  console.log('🧪 Testing CCL-3 SWARM Agent Communication Flow\n');

  try {
    // 1. Create a test lead directly
    console.log('1️⃣ Creating test lead...');
    const testLead = await LeadsRepository.create({
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      source: 'test-script',
      campaign: 'test-campaign',
      status: 'new',
      assignedChannel: null,
      qualificationScore: 0,
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      },
      boberdooId: null
    });
    console.log(`✅ Lead created: ${testLead.id} - ${testLead.name}\n`);

    // 2. Wait and check for agent decisions
    console.log('2️⃣ Waiting for agent processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const decisions = await AgentDecisionsRepository.findByLeadId(testLead.id);
    console.log(`Found ${decisions.length} agent decisions:`);
    decisions.forEach(d => {
      console.log(`  - ${d.agentType}: ${d.action} - ${d.reasoning}`);
    });
    console.log();

    // 3. Check for conversations
    const conversations = await ConversationsRepository.findByLeadId(testLead.id);
    console.log(`3️⃣ Found ${conversations.length} conversations:`);
    conversations.forEach(c => {
      console.log(`  - ${c.agentType} (${c.direction}): ${c.content.substring(0, 100)}...`);
    });
    console.log();

    // 4. Check for communications
    const communications = await CommunicationsRepository.findByLeadId(testLead.id);
    console.log(`4️⃣ Found ${communications.length} communications:`);
    communications.forEach(c => {
      console.log(`  - ${c.channel} (${c.status}): ${c.content.substring(0, 100)}...`);
    });
    console.log();

    // 5. Check updated lead status
    const updatedLead = await LeadsRepository.findById(testLead.id);
    console.log(`5️⃣ Lead status update:`);
    console.log(`  - Status: ${updatedLead?.status}`);
    console.log(`  - Assigned Channel: ${updatedLead?.assignedChannel}`);
    console.log(`  - Qualification Score: ${updatedLead?.qualificationScore}`);
    console.log();

    // Summary
    if (decisions.length > 0 && conversations.length > 0) {
      console.log('✅ SUCCESS: Agent communication flow is working!');
      console.log('The system successfully:');
      console.log('  1. Received the lead');
      console.log('  2. Made routing decisions');
      console.log('  3. Generated conversations');
      console.log('  4. Sent communications (if API keys are configured)');
    } else {
      console.log('⚠️  WARNING: Agent flow may not be fully connected');
      console.log('Make sure the server is running and processNewLead is being called');
    }

  } catch (error) {
    console.error('❌ Error testing agent flow:', error);
  }

  process.exit(0);
}

// Run the test
testAgentFlow();
