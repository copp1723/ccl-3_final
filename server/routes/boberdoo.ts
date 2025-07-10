import { Router } from 'express';
import { nanoid } from 'nanoid';
import { validateApiKey, formatXmlResponse } from '../middleware/api-auth';
import { getOverlordAgent } from '../agents';
import { Lead, LeadsRepository, AgentDecisionsRepository } from '../db';
import { z } from 'zod';
import { validate } from '../middleware/validation';

const router = Router();

// Lead post schema
const leadPostSchema = z.object({
  Test_Lead: z.string().optional(),
  src: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  zip: z.string().optional(),
  campaign: z.string().optional()
}).passthrough(); // Allow additional fields

// Boberdoo-compatible lead posting endpoint
router.post('/api/postLead', 
  validateApiKey, 
  validate(leadPostSchema),
  async (req, res) => {
  try {
    const {
      Test_Lead,
      src,
      name,
      email,
      phone,
      zip,
      ...otherFields
    } = req.body;

    // Check if this is a test lead
    const isTestLead = Test_Lead === '1' || zip === '99999';
    
    console.log(`Received ${isTestLead ? 'TEST' : 'LIVE'} lead from source: ${src}`);

    // Create lead object (without id - let database generate it)
    const leadData = {
      name: name || 'Unknown',
      email: email,
      phone: phone,
      source: src || 'api',
      campaignId: otherFields.campaign ? parseInt(otherFields.campaign, 10) : null,
      status: 'new',
      assignedChannel: null,
      qualificationScore: 0,
      metadata: {
        ...otherFields,
        zip,
        Test_Lead: Test_Lead,
        receivedAt: new Date().toISOString()
      },
      boberdooId: null
    };

    // Get the Overlord agent to make a decision
    const overlord = getOverlordAgent();
    
    // For test leads, skip to Boberdoo submission
    if (isTestLead) {
      // Create a temporary lead object for Boberdoo submission with all required fields
      const tempLead: Lead = {
        ...leadData,
        id: 9999999, // Use a fake numeric ID for test
        createdAt: new Date(),
        updatedAt: new Date(),
        conversationMode: null,
        templateStage: null,
        templateCurrent: null,
        templateTotal: null,
        aiSentiment: null,
        modeSwitchedAt: null,
        lastTemplateSentAt: null,
        firstReplyAt: null
      };
      const boberdooResult = await overlord.submitToBoberdoo(tempLead, true);
      
      // Don't save test leads to database
      console.log('Test lead processed (not saved):', {
        leadId: tempLead.id,
        matched: boberdooResult.matched,
        buyerId: boberdooResult.buyerId
      });

      // Return XML response
      return res.status(200).type('application/xml').send(formatXmlResponse({
        status: boberdooResult.matched ? 'matched' : 'unmatched',
        lead_id: tempLead.id.toString(),
        buyer_id: boberdooResult.buyerId || '',
        price: boberdooResult.price || 0,
        message: boberdooResult.matched ? 'Test lead matched successfully' : 'No buyer found for test lead'
      }));
    }

    // For live leads, save to database and process normally
    const savedLead = await LeadsRepository.create(leadData);
    
    // Make initial routing decision
    const decision = await overlord.makeDecision({ lead: savedLead });
    
    // Record the decision
    await AgentDecisionsRepository.create(
      savedLead.id.toString(),
      'overlord',
      decision.action,
      decision.reasoning,
      decision.data || {}
    );
    
    // Return immediate response
    res.status(200).type('application/xml').send(formatXmlResponse({
      status: 'accepted',
      lead_id: savedLead.id,
      action: decision.action,
      channel: decision.data?.channel,
      message: 'Lead received and queued for processing'
    }));

    // Import the processNewLead function to trigger agent communication
    // This will be handled by the WebSocket broadcast in the main server file
    // The server's WebSocket handler will pick up the 'new_lead' event and process it
    
  } catch (error) {
    console.error('Error processing lead:', error);
    res.status(400).type('application/xml').send(formatXmlResponse({
      status: 'error',
      message: error instanceof Error ? error.message : 'Invalid lead data'
    }));
  }
});

// Ping endpoint for testing
router.get('/api/ping', (req, res) => {
  res.status(200).type('application/xml').send(formatXmlResponse({
    status: 'ok',
    message: 'CCL3 SWARM API is running',
    timestamp: new Date().toISOString()
  }));
});

// Lead status check endpoint
router.get('/api/leadStatus/:leadId', validateApiKey, async (req, res) => {
  try {
    const { leadId } = req.params;
    
    // Fetch lead from database
    const lead = await LeadsRepository.findById(leadId);
    
    if (!lead) {
      return res.status(404).type('application/xml').send(formatXmlResponse({
        status: 'not_found',
        message: 'Lead not found'
      }));
    }
    
    res.status(200).type('application/xml').send(formatXmlResponse({
      status: 'found',
      lead_id: leadId,
      lead_status: lead.status,
      channel: lead.assignedChannel || 'none',
      boberdoo_id: lead.boberdooId || '',
      last_updated: lead.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('Error fetching lead status:', error);
    res.status(500).type('application/xml').send(formatXmlResponse({
      status: 'error',
      message: 'Internal server error'
    }));
  }
});

export default router;